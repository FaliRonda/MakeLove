-- MakeLove - Requisitos de misión opcionales por action_type_id (sagas temáticas).
-- Misiones existentes sin action_type_id siguen contando cualquier acción.

ALTER TABLE public.mission_requirements
  ADD COLUMN IF NOT EXISTS action_type_id uuid NULL
    REFERENCES public.action_types(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.mission_requirements.action_type_id IS
  'Si no null, solo cuenta eventos de ese action_type. No compatible con target_type=couple en la misión.';

CREATE OR REPLACE FUNCTION public.trg_mission_requirement_action_type_check()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_target public.mission_target_type;
BEGIN
  IF NEW.action_type_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT m.target_type INTO v_target
  FROM public.missions m
  WHERE m.id = NEW.mission_id;

  IF v_target = 'couple' THEN
    RAISE EXCEPTION 'Las misiones en pareja no pueden filtrar por acción concreta';
  END IF;

  IF NEW.metric_type NOT IN (
    'actions_done',
    'requests_sent_confirmed',
    'requests_received_confirmed'
  ) THEN
    RAISE EXCEPTION 'action_type_id solo aplica a actions_done o solicitudes confirmadas';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mission_requirement_action_type_check ON public.mission_requirements;
CREATE TRIGGER mission_requirement_action_type_check
  BEFORE INSERT OR UPDATE ON public.mission_requirements
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_mission_requirement_action_type_check();

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
      progress_target := 0;
      RETURN NEXT;
      RETURN;
    END IF;
  ELSE
    v_member_ids := ARRAY[p_user_id];
  END IF;

  FOR v_req IN
    SELECT mr.metric_type, mr.required_amount, mr.prior_mission_ids, mr.action_type_id
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
          AND (v_req.action_type_id IS NULL OR ar.action_type_id = v_req.action_type_id)
          AND ar.performed_at >= v_ts_start AND ar.performed_at < v_as_of;
      ELSE
        SELECT COUNT(*)::integer INTO v_progress_value
        FROM public.action_records ar
        WHERE ar.user_id = ANY (v_member_ids)
          AND ar.request_id IS NULL
          AND (v_req.action_type_id IS NULL OR ar.action_type_id = v_req.action_type_id)
          AND ar.performed_at >= v_ts_start AND ar.performed_at < v_as_of;
      END IF;

    ELSIF v_req.metric_type = 'requests_sent_confirmed' THEN
      IF v_mission.target_type = 'individual' THEN
        SELECT COUNT(*)::integer INTO v_progress_value
        FROM public.action_requests r
        WHERE r.status = 'accepted'
          AND r.requester_id = p_user_id
          AND r.confirmed_at IS NOT NULL
          AND (v_req.action_type_id IS NULL OR r.action_type_id = v_req.action_type_id)
          AND r.confirmed_at >= v_ts_start AND r.confirmed_at < v_as_of;
      ELSE
        SELECT COUNT(*)::integer INTO v_progress_value
        FROM public.action_requests r
        WHERE r.status = 'accepted'
          AND r.confirmed_at IS NOT NULL
          AND r.requester_id = ANY (v_member_ids)
          AND r.target_user_id = ANY (v_member_ids)
          AND (v_req.action_type_id IS NULL OR r.action_type_id = v_req.action_type_id)
          AND r.confirmed_at >= v_ts_start AND r.confirmed_at < v_as_of;
      END IF;

    ELSIF v_req.metric_type = 'requests_received_confirmed' THEN
      IF v_mission.target_type = 'individual' THEN
        SELECT COUNT(*)::integer INTO v_progress_value
        FROM public.action_requests r
        WHERE r.status = 'accepted'
          AND r.target_user_id = p_user_id
          AND r.confirmed_at IS NOT NULL
          AND (v_req.action_type_id IS NULL OR r.action_type_id = v_req.action_type_id)
          AND r.confirmed_at >= v_ts_start AND r.confirmed_at < v_as_of;
      ELSE
        SELECT COUNT(*)::integer INTO v_progress_value
        FROM public.action_requests r
        WHERE r.status = 'accepted'
          AND r.confirmed_at IS NOT NULL
          AND r.requester_id = ANY (v_member_ids)
          AND r.target_user_id = ANY (v_member_ids)
          AND (v_req.action_type_id IS NULL OR r.action_type_id = v_req.action_type_id)
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

-- ========== Estado historia: requirements con action_type ==========
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
                      'prior_mission_ids', COALESCE(to_jsonb(mr.prior_mission_ids), '[]'::jsonb),
                      'action_type_id',    mr.action_type_id,
                      'action_type_name',  (
                        SELECT at.name
                        FROM public.action_types at
                        WHERE at.id = mr.action_type_id
                      )
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
