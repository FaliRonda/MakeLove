-- action_records: vincular al request cuando se crea por aceptar solicitud (para poder revertir)
ALTER TABLE public.action_records
  ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES public.action_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_action_records_request_id ON public.action_records(request_id);

-- accept_request: guardar request_id en el action_record creado
CREATE OR REPLACE FUNCTION public.accept_request(p_request_id UUID)
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
  SELECT points_balance INTO v_bal_a FROM users WHERE id = v_req.requester_id;
  SELECT points_balance INTO v_bal_b FROM users WHERE id = v_req.target_user_id;
  SELECT name INTO v_at_name FROM action_types WHERE id = v_req.action_type_id;

  UPDATE users SET points_balance = points_balance - v_req.points_cost, updated_at = now() WHERE id = v_req.requester_id;
  UPDATE users SET points_balance = points_balance + v_req.reward_amount, updated_at = now() WHERE id = v_req.target_user_id;

  INSERT INTO balance_transactions (user_id, balance_before, delta, balance_after, event_type, reference_id, description)
  VALUES (v_req.requester_id, v_bal_a, -v_req.points_cost, v_bal_a - v_req.points_cost, 'request_accepted', p_request_id,
    'Solicitud aceptada: ' || COALESCE(v_at_name, ''));
  INSERT INTO balance_transactions (user_id, balance_before, delta, balance_after, event_type, reference_id, description)
  VALUES (v_req.target_user_id, v_bal_b, v_req.reward_amount, v_bal_b + v_req.reward_amount, 'request_accepted', p_request_id,
    'Realizaste solicitud: ' || COALESCE(v_at_name, '') || ' (+1.2× valor)');

  INSERT INTO action_records (user_id, action_type_id, performed_at, notes, request_id)
  VALUES (v_req.target_user_id, v_req.action_type_id, now(), 'Solicitud aceptada de ' || (SELECT name FROM users WHERE id = v_req.requester_id), p_request_id);
  UPDATE action_requests SET status = 'accepted', responded_at = now() WHERE id = p_request_id;
  UPDATE notifications SET read = true WHERE reference_id = p_request_id AND type = 'action_request';
END;
$$;

-- Revertir solicitud resuelta: restablecer puntos y eliminar la solicitud (requester o target pueden ejecutarla)
CREATE OR REPLACE FUNCTION public.revert_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_refund INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  SELECT * INTO v_req FROM action_requests
  WHERE id = p_request_id AND (requester_id = auth.uid() OR target_user_id = auth.uid());
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Solicitud no encontrada o no autorizado';
  END IF;
  IF v_req.status NOT IN ('accepted', 'rejected', 'expired', 'cancelled') THEN
    RAISE EXCEPTION 'Solo se pueden revertir solicitudes ya resueltas';
  END IF;

  IF v_req.status = 'accepted' THEN
    -- Deshacer: requester recupera points_cost, target pierde reward_amount
    UPDATE users SET points_balance = points_balance + v_req.points_cost, updated_at = now() WHERE id = v_req.requester_id;
    UPDATE users SET points_balance = points_balance - v_req.reward_amount, updated_at = now() WHERE id = v_req.target_user_id;
    DELETE FROM balance_transactions WHERE reference_id = p_request_id;
    DELETE FROM action_records WHERE request_id = p_request_id;
  ELSIF v_req.status IN ('rejected', 'expired') THEN
    -- Deshacer: quitar el reembolso 0.2× al requester
    v_refund := (v_req.points_cost * 20) / 100;
    UPDATE users SET points_balance = points_balance - v_refund, updated_at = now() WHERE id = v_req.requester_id;
    DELETE FROM balance_transactions WHERE reference_id = p_request_id;
  END IF;
  -- cancelled: no se modificaron puntos

  DELETE FROM notifications WHERE reference_id = p_request_id;
  DELETE FROM action_requests WHERE id = p_request_id;
END;
$$;
