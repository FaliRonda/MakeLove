-- MakeLove - La migración 030 reemplazó _mission_progress_as_of y volvió a excluir
-- action_records con record_claim_id en actions_done. Las acciones confirmadas por la pareja
-- deben contar otra vez para misiones.

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
      RETURN NEXT;
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
