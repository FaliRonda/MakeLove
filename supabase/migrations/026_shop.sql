-- MakeLove - Tienda (Shop) + Admin write policies para Historia
-- Ejecutar en Supabase SQL Editor.

-- ==========================
-- Admin write para Historia
-- ==========================

CREATE POLICY "stories: admins gestionan" ON public.stories
  FOR ALL TO authenticated
  USING     (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK(EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "chapters: admins gestionan" ON public.chapters
  FOR ALL TO authenticated
  USING     (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK(EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "missions: admins gestionan" ON public.missions
  FOR ALL TO authenticated
  USING     (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK(EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "mission_requirements: admins gestionan" ON public.mission_requirements
  FOR ALL TO authenticated
  USING     (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK(EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- ==========================
-- Tipo ENUM de ítem de tienda
-- ==========================

CREATE TYPE shop_item_type AS ENUM ('name_color', 'badge', 'medal');

-- ==========================
-- Tabla shop_items
-- ==========================

CREATE TABLE public.shop_items (
  id              uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text          NOT NULL,
  description     text          NOT NULL DEFAULT '',
  item_type       shop_item_type NOT NULL,
  color_value     text,                           -- hex p.ej. '#ff4488'  (name_color)
  badge_symbol    text,                           -- emoji/texto           (badge)
  cost_piedritas  integer       NOT NULL DEFAULT 0 CHECK (cost_piedritas >= 0),
  is_temporary    boolean       NOT NULL DEFAULT false,
  available_until date,                           -- null = sin caducidad en tienda
  is_couple_item  boolean       NOT NULL DEFAULT false,
  is_active       boolean       NOT NULL DEFAULT true,
  sort_order      integer       NOT NULL DEFAULT 0,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_shop_items_type   ON public.shop_items(item_type);
CREATE INDEX idx_shop_items_active ON public.shop_items(is_active);

ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_items: autenticados leen activos" ON public.shop_items
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "shop_items: admins gestionan" ON public.shop_items
  FOR ALL TO authenticated
  USING     (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK(EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- ==========================
-- Tabla user_inventory
-- ==========================

CREATE TABLE public.user_inventory (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid        NOT NULL REFERENCES public.users(id)       ON DELETE CASCADE,
  item_id     uuid        NOT NULL REFERENCES public.shop_items(id)  ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz,
  is_equipped boolean     NOT NULL DEFAULT false,
  UNIQUE (user_id, item_id)
);

CREATE INDEX idx_user_inventory_user ON public.user_inventory(user_id);

ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;

-- Cada usuario ve su propio inventario; también puede ver el de su pareja para mostrar cosméticos
CREATE POLICY "user_inventory: ver propio y pareja" ON public.user_inventory
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.couple_members cm1
      JOIN public.couple_members cm2
        ON cm2.couple_id = cm1.couple_id AND cm2.user_id = auth.uid()
      WHERE cm1.user_id = user_inventory.user_id
    )
  );

CREATE POLICY "user_inventory: insertar propio"   ON public.user_inventory
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_inventory: actualizar propio" ON public.user_inventory
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ==========================
-- Columnas cosméticas en users
-- ==========================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS equipped_name_color text,  -- hex color equipado, null = defecto
  ADD COLUMN IF NOT EXISTS equipped_badge      text;  -- símbolo/emoji equipado, null = ninguno

-- ==========================
-- RPC: buy_shop_item
-- ==========================

CREATE OR REPLACE FUNCTION public.buy_shop_item(
  p_user_id uuid,
  p_item_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_item    public.shop_items%ROWTYPE;
  v_partner uuid;
  v_balance integer;
  v_inv_id  uuid;
  v_expires timestamptz;
BEGIN
  IF v_uid IS NULL OR v_uid <> p_user_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_item FROM public.shop_items WHERE id = p_item_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ítem no encontrado o inactivo';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_inventory WHERE user_id = p_user_id AND item_id = p_item_id) THEN
    RAISE EXCEPTION 'Ya posees este ítem';
  END IF;

  IF v_item.is_couple_item THEN
    SELECT partner_user_id INTO v_partner
    FROM public.get_active_couple_partner(p_user_id) LIMIT 1;
    IF v_partner IS NULL THEN
      RAISE EXCEPTION 'Necesitas estar en pareja para comprar este ítem';
    END IF;
  END IF;

  SELECT piedritas_balance INTO v_balance FROM public.users WHERE id = p_user_id;
  IF v_balance < v_item.cost_piedritas THEN
    RAISE EXCEPTION 'Piedritas insuficientes (tienes %, necesitas %)', v_balance, v_item.cost_piedritas;
  END IF;

  UPDATE public.users
  SET piedritas_balance = piedritas_balance - v_item.cost_piedritas
  WHERE id = p_user_id;

  INSERT INTO public.piedritas_transactions
    (user_id, balance_before, delta, balance_after, event_type, reference_id, description)
  VALUES
    (p_user_id, v_balance, -v_item.cost_piedritas,
     v_balance - v_item.cost_piedritas,
     'shop_purchase', p_item_id, 'Compra: ' || v_item.name);

  -- Para temporales, caducan al final del día available_until en Madrid
  IF v_item.is_temporary AND v_item.available_until IS NOT NULL THEN
    v_expires := ((v_item.available_until + interval '1 day')::timestamp AT TIME ZONE 'Europe/Madrid');
  END IF;

  INSERT INTO public.user_inventory (user_id, item_id, expires_at)
  VALUES (p_user_id, p_item_id, v_expires)
  RETURNING id INTO v_inv_id;

  -- En items de pareja, también se añade al inventario del partner
  IF v_item.is_couple_item AND v_partner IS NOT NULL THEN
    INSERT INTO public.user_inventory (user_id, item_id, expires_at)
    VALUES (v_partner, p_item_id, v_expires)
    ON CONFLICT (user_id, item_id) DO NOTHING;
  END IF;

  RETURN v_inv_id;
END;
$$;

REVOKE ALL ON FUNCTION public.buy_shop_item(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buy_shop_item(uuid, uuid) TO authenticated;

-- ==========================
-- RPC: equip_shop_item
-- ==========================

CREATE OR REPLACE FUNCTION public.equip_shop_item(
  p_user_id uuid,
  p_item_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_item public.shop_items%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR v_uid <> p_user_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_item FROM public.shop_items WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ítem no encontrado'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_inventory
    WHERE user_id = p_user_id AND item_id = p_item_id
      AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    RAISE EXCEPTION 'No posees este ítem o ha expirado';
  END IF;

  -- Desequipar todos los ítems del mismo tipo
  UPDATE public.user_inventory ui
  SET is_equipped = false
  WHERE ui.user_id = p_user_id
    AND ui.item_id IN (SELECT id FROM public.shop_items WHERE item_type = v_item.item_type);

  -- Equipar éste
  UPDATE public.user_inventory
  SET is_equipped = true
  WHERE user_id = p_user_id AND item_id = p_item_id;

  -- Actualizar columna desnormalizada en users
  IF v_item.item_type = 'name_color' THEN
    UPDATE public.users SET equipped_name_color = v_item.color_value WHERE id = p_user_id;
  ELSIF v_item.item_type = 'badge' THEN
    UPDATE public.users SET equipped_badge = v_item.badge_symbol WHERE id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.equip_shop_item(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equip_shop_item(uuid, uuid) TO authenticated;

-- ==========================
-- RPC: unequip_shop_item_type
-- ==========================

CREATE OR REPLACE FUNCTION public.unequip_shop_item_type(
  p_user_id  uuid,
  p_item_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR v_uid <> p_user_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.user_inventory ui
  SET is_equipped = false
  WHERE ui.user_id = p_user_id
    AND ui.item_id IN (
      SELECT id FROM public.shop_items
      WHERE item_type = p_item_type::shop_item_type
    );

  IF p_item_type = 'name_color' THEN
    UPDATE public.users SET equipped_name_color = null WHERE id = p_user_id;
  ELSIF p_item_type = 'badge' THEN
    UPDATE public.users SET equipped_badge = null WHERE id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.unequip_shop_item_type(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unequip_shop_item_type(uuid, text) TO authenticated;
