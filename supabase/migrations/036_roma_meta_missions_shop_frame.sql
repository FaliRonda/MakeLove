-- MakeLove - Métrica prior_missions_complete, recompensa shop en misión, ítems no comprables, marco avatar.

-- ========== Enums ==========
ALTER TYPE public.mission_metric_type ADD VALUE 'prior_missions_complete';
ALTER TYPE public.shop_item_type ADD VALUE 'avatar_frame';

-- ========== Columnas ==========
ALTER TABLE public.mission_requirements
  ADD COLUMN IF NOT EXISTS prior_mission_ids uuid[] NULL;

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS reward_shop_item_id uuid NULL REFERENCES public.shop_items(id) ON DELETE SET NULL;

ALTER TABLE public.shop_items
  ADD COLUMN IF NOT EXISTS is_purchasable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS frame_overlay_url text NULL;

UPDATE public.shop_items SET is_purchasable = true WHERE is_purchasable IS NULL;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS equipped_avatar_frame_url text NULL;

COMMENT ON COLUMN public.mission_requirements.prior_mission_ids IS 'Para metric_type=prior_missions_complete: pool de misiones; progress = cuántas tienen is_complete.';
COMMENT ON COLUMN public.missions.reward_shop_item_id IS 'Si no null, claim otorga este ítem al inventario (además de piedritas si reward_piedritas>0).';
COMMENT ON COLUMN public.shop_items.is_purchasable IS 'Si false, buy_shop_item rechaza; se puede otorgar por historia u otros medios.';
COMMENT ON COLUMN public.shop_items.frame_overlay_url IS 'Para item_type=avatar_frame: URL del overlay (p.ej. /shop/venetian-mask.svg).';

-- ========== Progreso misión ==========
CREATE OR REPLACE FUNCTION public._mission_progress_as_of(
  p_user_id uuid,
  p_mission_id uuid,
  p_now timestamptz
)
RETURNS TABLE (
  is_complete boolean,
  progress_value integer,
  progress_target integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mission           public.missions%ROWTYPE;
  v_chapters          record;
  v_member_ids        uuid[];
  v_progress_value    integer := 0;
  v_progress_target   integer := 0;
  v_req               record;
  v_as_of             timestamptz;
  v_ts_start          timestamptz;
  v_ts_end_exclusive  timestamptz;
  v_ok                boolean := true;
  v_prior_id          uuid;
  v_sub_complete      boolean;
BEGIN
  SELECT * INTO v_mission FROM public.missions m WHERE m.id = p_mission_id;
  IF v_mission.id IS NULL THEN
    RAISE EXCEPTION 'Misión no encontrada';
  END IF;

  SELECT c.*, s.start_date AS story_start_date, s.end_date AS story_end_date
  INTO v_chapters
  FROM public.chapters c
  JOIN public.stories s ON s.id = c.story_id
  WHERE c.id = v_mission.chapter_id;

  v_ts_start         := public._madrid_day_start(v_chapters.start_date);
  v_ts_end_exclusive := public._madrid_day_end_exclusive(v_chapters.end_date);
  v_as_of            := LEAST(p_now, v_ts_end_exclusive);

  IF v_mission.target_type = 'couple' THEN
    SELECT array_agg(cm.user_id ORDER BY cm.user_id) INTO v_member_ids
    FROM public.couple_members cm
    JOIN public.couple_members cm2 ON cm2.couple_id = cm.couple_id
    WHERE cm2.user_id = p_user_id;

    IF v_member_ids IS NULL OR array_length(v_member_ids, 1) <> 2 THEN
      is_complete    := false;
      progress_value := 0;
      progress_target               := 0;
      RETURN NEXT;
      RETURN;
    END IF;
  ELSE
    v_member_ids := ARRAY[p_user_id];
  END IF;

  FOR v_req IN
    SELECT mr.metric_type, mr.required_amount, mr.prior_mission_ids
    FROM public.mission_requirements mr
    WHERE mr.mission_id = p_mission_id
    ORDER BY mr.id
  LOOP
    v_progress_target := v_req.required_amount;

    IF v_req.metric_type = 'actions_done' THEN
      IF v_mission.target_type = 'individual' THEN
        SELECT COUNT(*)::integer INTO v_progress_value
        FROM public.action_records ar
        WHERE ar.user_id = p_user_id
          AND ar.request_id IS NULL
          AND ar.performed_at >= v_ts_start AND ar.performed_at < v_as_of;
      ELSE
        SELECT COUNT(*)::integer INTO v_progress_value
        FROM public.action_records ar
        WHERE ar.user_id = ANY (v_member_ids)
          AND ar.request_id IS NULL
          AND ar.performed_at >= v_ts_start AND ar.performed_at < v_as_of;
      END IF;

    ELSIF v_req.metric_type = 'requests_sent_confirmed' THEN
      IF v_mission.target_type = 'individual' THEN
        SELECT COUNT(*)::integer INTO v_progress_value
        FROM public.action_requests r
        WHERE r.status = 'accepted'
          AND r.requester_id = p_user_id
          AND r.confirmed_at IS NOT NULL
          AND r.confirmed_at >= v_ts_start AND r.confirmed_at < v_as_of;
      ELSE
        SELECT COUNT(*)::integer INTO v_progress_value
        FROM public.action_requests r
        WHERE r.status = 'accepted'
          AND r.confirmed_at IS NOT NULL
          AND r.requester_id = ANY (v_member_ids)
          AND r.target_user_id = ANY (v_member_ids)
          AND r.confirmed_at >= v_ts_start AND r.confirmed_at < v_as_of;
      END IF;

    ELSIF v_req.metric_type = 'requests_received_confirmed' THEN
      IF v_mission.target_type = 'individual' THEN
        SELECT COUNT(*)::integer INTO v_progress_value
        FROM public.action_requests r
        WHERE r.status = 'accepted'
          AND r.target_user_id = p_user_id
          AND r.confirmed_at IS NOT NULL
          AND r.confirmed_at >= v_ts_start AND r.confirmed_at < v_as_of;
      ELSE
        SELECT COUNT(*)::integer INTO v_progress_value
        FROM public.action_requests r
        WHERE r.status = 'accepted'
          AND r.confirmed_at IS NOT NULL
          AND r.requester_id = ANY (v_member_ids)
          AND r.target_user_id = ANY (v_member_ids)
          AND r.confirmed_at >= v_ts_start AND r.confirmed_at < v_as_of;
      END IF;

    ELSIF v_req.metric_type = 'points_gained' THEN
      IF v_mission.target_type = 'individual' THEN
        SELECT COALESCE(SUM(bt.delta), 0)::integer INTO v_progress_value
        FROM public.balance_transactions bt
        WHERE bt.user_id = p_user_id
          AND bt.delta > 0
          AND bt.created_at >= v_ts_start AND bt.created_at < v_as_of;
      ELSE
        SELECT COALESCE(SUM(bt.delta), 0)::integer INTO v_progress_value
        FROM public.balance_transactions bt
        WHERE bt.user_id = ANY (v_member_ids)
          AND bt.delta > 0
          AND bt.created_at >= v_ts_start AND bt.created_at < v_as_of;
      END IF;

    ELSIF v_req.metric_type = 'levels_gained' THEN
      IF v_mission.target_type = 'individual' THEN
        WITH sums AS (
          SELECT COALESCE(SUM(bt.delta), 0)::integer AS sum_pos
          FROM public.balance_transactions bt
          WHERE bt.user_id = p_user_id
            AND bt.delta > 0
            AND bt.created_at >= v_ts_start AND bt.created_at < v_as_of
        )
        SELECT (
          public._level_from_lifetime_points(u.lifetime_points_earned)
          - public._level_from_lifetime_points(u.lifetime_points_earned - s.sum_pos)
        )::integer
        INTO v_progress_value
        FROM public.users u CROSS JOIN sums s
        WHERE u.id = p_user_id;
      ELSE
        WITH sums AS (
          SELECT
            u.id AS user_id,
            u.lifetime_points_earned AS current_lifetime,
            COALESCE(SUM(bt.delta), 0)::integer AS sum_pos
          FROM public.users u
          LEFT JOIN public.balance_transactions bt
            ON bt.user_id = u.id
           AND bt.delta > 0
           AND bt.created_at >= v_ts_start AND bt.created_at < v_as_of
          WHERE u.id = ANY (v_member_ids)
          GROUP BY u.id, u.lifetime_points_earned
        ),
        levels AS (
          SELECT
            public._level_from_lifetime_points(current_lifetime)
            - public._level_from_lifetime_points(current_lifetime - sum_pos) AS levels_gained
          FROM sums
        )
        SELECT COALESCE(MIN(levels_gained), 0)::integer INTO v_progress_value
        FROM levels;
      END IF;

    ELSIF v_req.metric_type = 'prior_missions_complete' THEN
      v_progress_value := 0;
      IF v_req.prior_mission_ids IS NOT NULL AND array_length(v_req.prior_mission_ids, 1) IS NOT NULL THEN
        FOREACH v_prior_id IN ARRAY v_req.prior_mission_ids
        LOOP
          SELECT mp.is_complete INTO v_sub_complete
          FROM public._mission_progress_as_of(p_user_id, v_prior_id, p_now) mp
          LIMIT 1;
          IF COALESCE(v_sub_complete, false) THEN
            v_progress_value := v_progress_value + 1;
          END IF;
        END LOOP;
      END IF;

    ELSE
      v_progress_value := 0;
    END IF;

    IF v_progress_value < v_progress_target THEN
      v_ok := false;
    END IF;
  END LOOP;

  is_complete    := v_ok;
  progress_value := v_progress_value;
  progress_target := v_progress_target;
  RETURN NEXT;
END;
$$;

-- ========== Claim misión → jsonb ==========
DROP FUNCTION IF EXISTS public.claim_story_mission_reward(uuid, uuid);

CREATE FUNCTION public.claim_story_mission_reward(
  p_user_id uuid,
  p_mission_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_mission public.missions%ROWTYPE;
  v_chapter public.chapters%ROWTYPE;
  v_ts_end_exclusive timestamptz;
  v_is_complete boolean;
  v_reward integer;
  v_shop_id uuid;
  v_shop_item public.shop_items%ROWTYPE;
  v_couple_partner uuid;
  v_balance_before integer;
  v_balance_after integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'No user_id';
  END IF;

  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_mission FROM public.missions m WHERE m.id = p_mission_id;
  IF v_mission.id IS NULL THEN
    RAISE EXCEPTION 'Misión no encontrada';
  END IF;

  SELECT * INTO v_chapter FROM public.chapters c WHERE c.id = v_mission.chapter_id;

  v_ts_end_exclusive := public._madrid_day_end_exclusive(v_chapter.end_date);
  IF v_now >= v_ts_end_exclusive THEN
    RAISE EXCEPTION 'La misión ha expirado';
  END IF;

  IF v_mission.target_type = 'couple' THEN
    SELECT partner_user_id INTO v_couple_partner
    FROM public.get_active_couple_partner(p_user_id);
    IF v_couple_partner IS NULL THEN
      RAISE EXCEPTION 'La misión es en pareja pero no tienes pareja activa';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_story_mission_claims cm
    WHERE cm.user_id = p_user_id AND cm.mission_id = p_mission_id
  ) THEN
    RAISE EXCEPTION 'Ya has reclamado esta misión';
  END IF;

  SELECT progress.is_complete, m.reward_piedritas, m.reward_shop_item_id
  INTO v_is_complete, v_reward, v_shop_id
  FROM public._mission_progress_as_of(p_user_id, p_mission_id, v_now) progress
  JOIN public.missions m ON m.id = p_mission_id
  LIMIT 1;

  IF NOT v_is_complete THEN
    RAISE EXCEPTION 'Aún no has completado los requisitos de la misión';
  END IF;

  v_reward := COALESCE(v_reward, 0);

  IF v_shop_id IS NOT NULL THEN
    SELECT * INTO v_shop_item FROM public.shop_items WHERE id = v_shop_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Recompensa de tienda inválida';
    END IF;

    INSERT INTO public.user_inventory (user_id, item_id, expires_at)
    VALUES (p_user_id, v_shop_id, NULL)
    ON CONFLICT (user_id, item_id) DO NOTHING;

    IF v_shop_item.is_couple_item AND v_couple_partner IS NOT NULL THEN
      INSERT INTO public.user_inventory (user_id, item_id, expires_at)
      VALUES (v_couple_partner, v_shop_id, NULL)
      ON CONFLICT (user_id, item_id) DO NOTHING;
    END IF;
  END IF;

  IF v_reward > 0 THEN
    SELECT piedritas_balance INTO v_balance_before
    FROM public.users u
    WHERE u.id = p_user_id
    FOR UPDATE;

    v_balance_after := v_balance_before + v_reward;

    UPDATE public.users
    SET piedritas_balance = v_balance_after,
        updated_at = now()
    WHERE id = p_user_id;

    INSERT INTO public.piedritas_transactions(
      user_id, balance_before, delta, balance_after,
      event_type, reference_id, description
    ) VALUES (
      p_user_id, v_balance_before, v_reward, v_balance_after,
      'story_mission_claim',
      p_mission_id,
      'Recompensa misión: ' || v_mission.title
    );
  END IF;

  INSERT INTO public.user_story_mission_claims(user_id, mission_id)
  VALUES (p_user_id, p_mission_id);

  RETURN jsonb_build_object(
    'piedritas', v_reward,
    'shop_item', CASE
      WHEN v_shop_id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', v_shop_item.id,
        'name', v_shop_item.name,
        'item_type', v_shop_item.item_type::text,
        'badge_symbol', v_shop_item.badge_symbol,
        'frame_overlay_url', v_shop_item.frame_overlay_url
      )
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_story_mission_reward(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_story_mission_reward(uuid, uuid) TO authenticated;

-- ========== Estado historia (requirements + recompensa shop) ==========
CREATE OR REPLACE FUNCTION public.get_active_story_state(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now   timestamptz := now();
  v_today date        := (timezone('Europe/Madrid', v_now))::date;
  v_story record;
  v_partner uuid;
BEGIN
  SELECT * INTO v_story
  FROM public.stories s
  WHERE s.start_date <= v_today AND s.end_date >= v_today
  ORDER BY s.start_date ASC
  LIMIT 1;

  IF v_story.id IS NULL THEN
    SELECT * INTO v_story
    FROM public.stories s
    WHERE s.start_date > v_today
    ORDER BY s.start_date ASC
    LIMIT 1;
  END IF;

  SELECT partner_user_id INTO v_partner
  FROM public.get_active_couple_partner(p_user_id) t
  LIMIT 1;

  RETURN jsonb_build_object(
    'as_of',           v_now,
    'user_id',         p_user_id,
    'partner_user_id', v_partner,
    'story', CASE WHEN v_story.id IS NULL THEN null ELSE jsonb_build_object(
      'id',          v_story.id,
      'name',        v_story.name,
      'description', v_story.description,
      'start_date',  v_story.start_date,
      'end_date',    v_story.end_date
    ) END,
    'chapters', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',           c.id,
          'name',         c.name,
          'order_number', c.order_number,
          'start_date',   c.start_date,
          'end_date',     c.end_date,
          'missions', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id',               m.id,
                'order_number',       m.order_number,
                'title',              m.title,
                'description',        m.description,
                'target_type',        m.target_type,
                'reward_piedritas',   m.reward_piedritas,
                'reward_shop_item',   CASE WHEN m.reward_shop_item_id IS NULL THEN NULL ELSE (
                  SELECT jsonb_build_object(
                    'id',               si.id,
                    'name',             si.name,
                    'description',      si.description,
                    'item_type',        si.item_type::text,
                    'badge_symbol',     si.badge_symbol,
                    'frame_overlay_url', si.frame_overlay_url
                  )
                  FROM public.shop_items si
                  WHERE si.id = m.reward_shop_item_id
                ) END,
                'requirements', COALESCE((
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'metric_type',       mr.metric_type::text,
                      'required_amount',   mr.required_amount,
                      'prior_mission_ids', COALESCE(to_jsonb(mr.prior_mission_ids), '[]'::jsonb)
                    )
                    ORDER BY mr.id
                  )
                  FROM public.mission_requirements mr
                  WHERE mr.mission_id = m.id
                ), '[]'::jsonb),
                'claimed', EXISTS(
                  SELECT 1
                  FROM public.user_story_mission_claims cm
                  WHERE cm.user_id = p_user_id AND cm.mission_id = m.id
                ),
                'progress', (
                  SELECT jsonb_build_object(
                    'is_complete',    prog.is_complete,
                    'progress_value', prog.progress_value,
                    'progress_target', prog.progress_target
                  )
                  FROM public._mission_progress_as_of(p_user_id, m.id, v_now) prog
                  LIMIT 1
                )
              )
              ORDER BY m.order_number ASC
            )
            FROM public.missions m
            WHERE m.chapter_id = c.id
          )
        )
        ORDER BY c.order_number ASC
      )
      FROM public.chapters c
      WHERE c.story_id = v_story.id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_active_story_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_story_state(uuid) TO authenticated;

-- ========== Tienda: no comprables + equip marco ==========
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

  IF v_item.is_purchasable IS NOT TRUE THEN
    RAISE EXCEPTION 'Este ítem no está a la venta';
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

  UPDATE public.user_inventory ui
  SET is_equipped = false
  WHERE ui.user_id = p_user_id
    AND ui.item_id IN (SELECT id FROM public.shop_items WHERE item_type = v_item.item_type);

  UPDATE public.user_inventory
  SET is_equipped = true
  WHERE user_id = p_user_id AND item_id = p_item_id;

  IF v_item.item_type = 'name_color' THEN
    UPDATE public.users SET equipped_name_color = v_item.color_value WHERE id = p_user_id;
  ELSIF v_item.item_type = 'badge' THEN
    UPDATE public.users SET equipped_badge = v_item.badge_symbol WHERE id = p_user_id;
  ELSIF v_item.item_type = 'avatar_frame' THEN
    UPDATE public.users SET equipped_avatar_frame_url = v_item.frame_overlay_url WHERE id = p_user_id;
  END IF;
END;
$$;

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
  ELSIF p_item_type = 'avatar_frame' THEN
    UPDATE public.users SET equipped_avatar_frame_url = null WHERE id = p_user_id;
  END IF;
END;
$$;
