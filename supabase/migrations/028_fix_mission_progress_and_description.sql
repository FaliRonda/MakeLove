-- MakeLove - Fix: _mission_progress_as_of usaba RETURN en lugar de RETURN NEXT
--             + añade description a las misiones en get_active_story_state

-- ============================================================
-- 1) _mission_progress_as_of: RETURN → RETURN NEXT
-- ============================================================

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
  v_mission     public.missions%ROWTYPE;
  v_chapters    record;
  v_member_ids  uuid[];
  v_progress_value  integer := 0;
  v_progress_target integer := 0;
  v_req         record;
  v_as_of       timestamptz;
  v_ts_start    timestamptz;
  v_ts_end_exclusive timestamptz;
  v_ok          boolean := true;
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
      RETURN NEXT;   -- emite la fila y sale
      RETURN;
    END IF;
  ELSE
    v_member_ids := ARRAY[p_user_id];
  END IF;

  FOR v_req IN
    SELECT mr.metric_type, mr.required_amount
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
          AND ar.record_claim_id IS NULL
          AND ar.performed_at >= v_ts_start AND ar.performed_at < v_as_of;
      ELSE
        SELECT COUNT(*)::integer INTO v_progress_value
        FROM public.action_records ar
        WHERE ar.user_id = ANY (v_member_ids)
          AND ar.request_id IS NULL
          AND ar.record_claim_id IS NULL
          AND ar.performed_at >= v_ts_start AND ar.performed_at < v_as_of;
      END IF;

    ELSIF v_req.metric_type = 'requests_sent_confirmed' THEN
      IF v_mission.target_type = 'individual' THEN
        SELECT COUNT(*)::integer INTO v_progress_value
        FROM public.action_requests r
        WHERE r.status = 'accepted'
          AND r.requester_id = p_user_id
          AND r.responded_at IS NOT NULL
          AND r.responded_at >= v_ts_start AND r.responded_at < v_as_of;
      ELSE
        SELECT COUNT(*)::integer INTO v_progress_value
        FROM public.action_requests r
        WHERE r.status = 'accepted'
          AND r.responded_at IS NOT NULL
          AND r.requester_id = ANY (v_member_ids)
          AND r.target_user_id = ANY (v_member_ids)
          AND r.responded_at >= v_ts_start AND r.responded_at < v_as_of;
      END IF;

    ELSIF v_req.metric_type = 'requests_received_confirmed' THEN
      IF v_mission.target_type = 'individual' THEN
        SELECT COUNT(*)::integer INTO v_progress_value
        FROM public.action_requests r
        WHERE r.status = 'accepted'
          AND r.target_user_id = p_user_id
          AND r.responded_at IS NOT NULL
          AND r.responded_at >= v_ts_start AND r.responded_at < v_as_of;
      ELSE
        SELECT COUNT(*)::integer INTO v_progress_value
        FROM public.action_requests r
        WHERE r.status = 'accepted'
          AND r.responded_at IS NOT NULL
          AND r.requester_id = ANY (v_member_ids)
          AND r.target_user_id = ANY (v_member_ids)
          AND r.responded_at >= v_ts_start AND r.responded_at < v_as_of;
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

    ELSE
      v_progress_value := 0;
    END IF;

    IF v_progress_value < v_progress_target THEN
      v_ok := false;
    END IF;
  END LOOP;

  -- Si no hay requisitos, progreso 0/0 y completado por defecto
  is_complete    := v_ok;
  progress_value := v_progress_value;
  progress_target := v_progress_target;
  RETURN NEXT;   -- ← era RETURN; (no emitía la fila)
END;
$$;

-- ============================================================
-- 2) get_active_story_state: añade description a cada misión
-- ============================================================

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
                'order_number',     m.order_number,
                'title',            m.title,
                'description',      m.description,
                'target_type',      m.target_type,
                'reward_piedritas', m.reward_piedritas,
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
