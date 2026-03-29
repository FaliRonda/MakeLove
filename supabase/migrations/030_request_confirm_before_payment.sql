-- Solicitudes: B acepta sin mover puntos; A confirma cumplimiento → cobro/pago e historial.

-- 1) Nuevo estado intermedio
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'accepted_pending';

-- 2) Momento en que el solicitante confirma (pago efectivo). Migración de datos ya aceptados.
ALTER TABLE public.action_requests
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

UPDATE public.action_requests
SET confirmed_at = responded_at
WHERE status = 'accepted'
  AND confirmed_at IS NULL
  AND responded_at IS NOT NULL;

-- 3) Aceptar: solo compromiso de B; notifica a A para que confirme después.
CREATE OR REPLACE FUNCTION public.accept_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_at_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  SELECT * INTO v_req FROM action_requests WHERE id = p_request_id AND target_user_id = auth.uid();
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Solicitud no encontrada o no autorizado';
  END IF;
  IF v_req.status != 'pending' THEN
    RAISE EXCEPTION 'La solicitud ya fue respondida';
  END IF;
  IF v_req.expires_at < now() THEN
    UPDATE action_requests SET status = 'expired', responded_at = now() WHERE id = p_request_id;
    RAISE EXCEPTION 'La solicitud ha caducado';
  END IF;
  SELECT name INTO v_at_name FROM action_types WHERE id = v_req.action_type_id;

  UPDATE action_requests
  SET status = 'accepted_pending', responded_at = now(), confirmed_at = NULL
  WHERE id = p_request_id;

  UPDATE notifications SET read = true WHERE reference_id = p_request_id AND type = 'action_request';

  INSERT INTO notifications (user_id, type, reference_id)
  VALUES (v_req.requester_id, 'request_accepted_pending', p_request_id);
END;
$$;

-- 4) Confirmar cumplimiento (solo solicitante): descuenta A, abona B, historial y transacciones.
CREATE OR REPLACE FUNCTION public.confirm_request_completion(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_bal_a INTEGER;
  v_bal_b INTEGER;
  v_at_name TEXT;
  v_requester_name TEXT;
  v_target_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  SELECT * INTO v_req FROM action_requests WHERE id = p_request_id AND requester_id = auth.uid();
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Solicitud no encontrada o no eres el solicitante';
  END IF;
  IF v_req.status != 'accepted_pending' THEN
    RAISE EXCEPTION 'Esta solicitud no está pendiente de tu confirmación';
  END IF;

  SELECT points_balance INTO v_bal_a FROM users WHERE id = v_req.requester_id;
  IF v_bal_a < v_req.points_cost THEN
    RAISE EXCEPTION 'Saldo insuficiente. Necesitas al menos % puntos para confirmar la solicitud.', v_req.points_cost;
  END IF;

  SELECT points_balance INTO v_bal_b FROM users WHERE id = v_req.target_user_id;
  SELECT name INTO v_at_name FROM action_types WHERE id = v_req.action_type_id;
  SELECT name INTO v_requester_name FROM users WHERE id = v_req.requester_id;
  SELECT name INTO v_target_name FROM users WHERE id = v_req.target_user_id;

  UPDATE users SET points_balance = points_balance - v_req.points_cost, updated_at = now() WHERE id = v_req.requester_id;
  UPDATE users SET points_balance = points_balance + v_req.reward_amount, updated_at = now() WHERE id = v_req.target_user_id;

  INSERT INTO balance_transactions (user_id, balance_before, delta, balance_after, event_type, reference_id, description)
  VALUES (v_req.requester_id, v_bal_a, -v_req.points_cost, v_bal_a - v_req.points_cost, 'request_accepted', p_request_id,
    'Solicitud confirmada (pago): ' || COALESCE(v_at_name, ''));
  INSERT INTO balance_transactions (user_id, balance_before, delta, balance_after, event_type, reference_id, description)
  VALUES (v_req.target_user_id, v_bal_b, v_req.reward_amount, v_bal_b + v_req.reward_amount, 'request_accepted', p_request_id,
    'Solicitud cumplida — confirmada por ' || COALESCE(v_requester_name, '') || ': ' || COALESCE(v_at_name, ''));

  INSERT INTO action_records (user_id, action_type_id, performed_at, notes, request_id, target_user_id)
  VALUES (v_req.target_user_id, v_req.action_type_id, now(),
    'Solicitud cumplida — confirmada por ' || COALESCE(v_requester_name, ''), p_request_id, v_req.requester_id);
  INSERT INTO action_records (user_id, action_type_id, performed_at, notes, request_id, target_user_id)
  VALUES (v_req.requester_id, v_req.action_type_id, now(),
    'Confirmaste la solicitud cumplida por ' || COALESCE(v_target_name, ''), p_request_id, v_req.target_user_id);

  UPDATE action_requests
  SET status = 'accepted', confirmed_at = now()
  WHERE id = p_request_id;

  UPDATE notifications SET read = true WHERE reference_id = p_request_id AND type = 'request_accepted_pending';

  INSERT INTO notifications (user_id, type, reference_id)
  VALUES (v_req.target_user_id, 'request_confirmed_target', p_request_id);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_request_completion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_request_completion(uuid) TO authenticated;

-- 5) Cancelar: también si estaba aceptada por B pero sin confirmar A.
CREATE OR REPLACE FUNCTION public.cancel_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  SELECT * INTO v_req FROM action_requests WHERE id = p_request_id AND requester_id = auth.uid();
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Solicitud no encontrada o no eres el creador';
  END IF;
  IF v_req.status = 'accepted_pending' THEN
    UPDATE action_requests SET status = 'cancelled', responded_at = now() WHERE id = p_request_id;
    UPDATE notifications SET read = true WHERE reference_id = p_request_id AND type = 'action_request';
    DELETE FROM notifications WHERE reference_id = p_request_id AND type = 'request_accepted_pending';
    RETURN;
  END IF;
  IF v_req.status != 'pending' THEN
    RAISE EXCEPTION 'La solicitud ya fue respondida o cancelada';
  END IF;
  IF v_req.expires_at < now() THEN
    UPDATE action_requests SET status = 'expired', responded_at = now() WHERE id = p_request_id;
    RAISE EXCEPTION 'La solicitud ha caducado';
  END IF;

  UPDATE action_requests SET status = 'cancelled', responded_at = now() WHERE id = p_request_id;
  UPDATE notifications SET read = true WHERE reference_id = p_request_id AND type = 'action_request';
END;
$$;

-- 6) Revertir: incluye accepted_pending (sin movimientos de saldo).
CREATE OR REPLACE FUNCTION public.revert_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_refund INTEGER;
  v_requester_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  SELECT * INTO v_req FROM action_requests
  WHERE id = p_request_id AND (requester_id = auth.uid() OR target_user_id = auth.uid());
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Solicitud no encontrada o no autorizado';
  END IF;
  IF v_req.status NOT IN ('accepted', 'accepted_pending', 'rejected', 'expired', 'cancelled') THEN
    RAISE EXCEPTION 'Solo se pueden revertir solicitudes ya resueltas';
  END IF;

  IF v_req.status = 'accepted' THEN
    UPDATE users SET points_balance = points_balance + v_req.points_cost, updated_at = now() WHERE id = v_req.requester_id;
    UPDATE users SET points_balance = points_balance - v_req.reward_amount, updated_at = now() WHERE id = v_req.target_user_id;
    DELETE FROM balance_transactions WHERE reference_id = p_request_id;
    SELECT name INTO v_requester_name FROM users WHERE id = v_req.requester_id;
    DELETE FROM action_records WHERE request_id = p_request_id;
    DELETE FROM action_records
    WHERE request_id IS NULL
      AND user_id = v_req.target_user_id
      AND action_type_id = v_req.action_type_id
      AND notes = 'Solicitud aceptada de ' || COALESCE(v_requester_name, '')
      AND performed_at >= v_req.responded_at - interval '2 minutes'
      AND performed_at <= v_req.responded_at + interval '2 minutes';
  ELSIF v_req.status IN ('rejected', 'expired') THEN
    v_refund := (v_req.points_cost * 20) / 100;
    UPDATE users SET points_balance = points_balance - v_refund, updated_at = now() WHERE id = v_req.requester_id;
    DELETE FROM balance_transactions WHERE reference_id = p_request_id;
  END IF;
  -- accepted_pending, cancelled: sin ajuste de saldo

  DELETE FROM notifications WHERE reference_id = p_request_id;
  DELETE FROM action_requests WHERE id = p_request_id;
END;
$$;

-- 7) Misiones: contar solicitudes confirmadas por fecha de confirmación (no por aceptación de B).
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
