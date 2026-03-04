-- Quitar "(pagado a quien realizó)" de la descripción al aceptar solicitud
UPDATE balance_transactions
SET description = REPLACE(description, ' (pagado a quien realizó)', '')
WHERE description LIKE '% (pagado a quien realizó)';

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

  INSERT INTO action_records (user_id, action_type_id, performed_at, notes)
  VALUES (v_req.target_user_id, v_req.action_type_id, now(), 'Solicitud aceptada de ' || (SELECT name FROM users WHERE id = v_req.requester_id));
  UPDATE action_requests SET status = 'accepted', responded_at = now() WHERE id = p_request_id;
  UPDATE notifications SET read = true WHERE reference_id = p_request_id AND type = 'action_request';
END;
$$;
