-- Al revertir una solicitud aceptada, borrar también el action_record "legacy"
-- (creado antes de tener request_id), identificándolo por usuario, acción, notas y fecha.
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
  IF v_req.status NOT IN ('accepted', 'rejected', 'expired', 'cancelled') THEN
    RAISE EXCEPTION 'Solo se pueden revertir solicitudes ya resueltas';
  END IF;

  IF v_req.status = 'accepted' THEN
    -- Deshacer: requester recupera points_cost, target pierde reward_amount
    UPDATE users SET points_balance = points_balance + v_req.points_cost, updated_at = now() WHERE id = v_req.requester_id;
    UPDATE users SET points_balance = points_balance - v_req.reward_amount, updated_at = now() WHERE id = v_req.target_user_id;
    DELETE FROM balance_transactions WHERE reference_id = p_request_id;
    -- Con request_id (registros nuevos)
    DELETE FROM action_records WHERE request_id = p_request_id;
    -- Legacy: registros creados antes de tener request_id (mismo target, acción, notas y fecha próxima a responded_at)
    SELECT name INTO v_requester_name FROM users WHERE id = v_req.requester_id;
    DELETE FROM action_records
    WHERE request_id IS NULL
      AND user_id = v_req.target_user_id
      AND action_type_id = v_req.action_type_id
      AND notes = 'Solicitud aceptada de ' || COALESCE(v_requester_name, '')
      AND performed_at >= v_req.responded_at - interval '2 minutes'
      AND performed_at <= v_req.responded_at + interval '2 minutes';
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
