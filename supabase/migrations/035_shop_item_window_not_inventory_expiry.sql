-- is_temporary + available_until describen la ventana en TIENDA (cuándo se puede comprar / se muestra).
-- Una vez comprado, el objeto permanece en inventario: no copiar esa fecha a user_inventory.expires_at.

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

  INSERT INTO public.user_inventory (user_id, item_id, expires_at)
  VALUES (p_user_id, p_item_id, NULL)
  RETURNING id INTO v_inv_id;

  IF v_item.is_couple_item AND v_partner IS NOT NULL THEN
    INSERT INTO public.user_inventory (user_id, item_id, expires_at)
    VALUES (v_partner, p_item_id, NULL)
    ON CONFLICT (user_id, item_id) DO NOTHING;
  END IF;

  RETURN v_inv_id;
END;
$$;

-- Quitar caducidades erróneas heredadas (ventana de tienda confundida con caducidad del ítem).
UPDATE public.user_inventory ui
SET expires_at = NULL
FROM public.shop_items si
WHERE si.id = ui.item_id
  AND si.is_temporary = true
  AND si.available_until IS NOT NULL
  AND ui.expires_at IS NOT NULL;
