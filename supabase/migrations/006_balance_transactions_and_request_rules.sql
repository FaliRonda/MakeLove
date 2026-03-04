-- Tabla historial de saldo (para Dashboard)
CREATE TABLE public.balance_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  balance_before INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_balance_transactions_user_id ON public.balance_transactions(user_id);
CREATE INDEX idx_balance_transactions_created_at ON public.balance_transactions(created_at DESC);

ALTER TABLE public.balance_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Balance transactions: ver propias" ON public.balance_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Crear solicitud: reward_amount = 1.2 * points_value (lo que gana B al aceptar), rechazo/caducidad = 0.2 * points_value para A
CREATE OR REPLACE FUNCTION public.create_action_request(
  p_target_user_id UUID,
  p_action_type_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_id UUID := auth.uid();
  v_at RECORD;
  v_points_cost INTEGER;
  v_reward_amount INTEGER;
  v_request_id UUID;
  v_requester_balance INTEGER;
  v_duplicate BOOLEAN;
BEGIN
  IF v_requester_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF v_requester_id = p_target_user_id THEN
    RAISE EXCEPTION 'No puedes solicitarte a ti mismo';
  END IF;
  SELECT * INTO v_at FROM action_types WHERE id = p_action_type_id AND is_active = true;
  IF v_at.id IS NULL THEN
    RAISE EXCEPTION 'Acción no encontrada o inactiva';
  END IF;
  SELECT points_balance INTO v_requester_balance FROM users WHERE id = v_requester_id;
  v_points_cost := v_at.points_value;
  IF v_requester_balance < v_points_cost THEN
    RAISE EXCEPTION 'Saldo insuficiente. Necesitas % puntos.', v_points_cost;
  END IF;
  -- B gana 1.2x al aceptar; A gana 0.2x si rechazo/caducidad
  v_reward_amount := (v_at.points_value * 120) / 100;
  SELECT EXISTS(
    SELECT 1 FROM action_requests
    WHERE requester_id = v_requester_id AND target_user_id = p_target_user_id
      AND action_type_id = p_action_type_id AND status = 'pending'
  ) INTO v_duplicate;
  IF v_duplicate THEN
    RAISE EXCEPTION 'Ya tienes una solicitud pendiente de esta acción para este usuario';
  END IF;
  INSERT INTO action_requests (requester_id, target_user_id, action_type_id, points_cost, reward_amount, expires_at)
  VALUES (v_requester_id, p_target_user_id, p_action_type_id, v_points_cost, v_reward_amount, now() + interval '12 hours')
  RETURNING id INTO v_request_id;
  INSERT INTO notifications (user_id, type, reference_id)
  VALUES (p_target_user_id, 'action_request', v_request_id);
  RETURN v_request_id;
END;
$$;

-- Aceptar solicitud: A pierde points_cost, B gana reward_amount (1.2x); registrar en balance_transactions
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
    'Solicitud aceptada: ' || COALESCE(v_at_name, '') || ' (pagado a quien realizó)');
  INSERT INTO balance_transactions (user_id, balance_before, delta, balance_after, event_type, reference_id, description)
  VALUES (v_req.target_user_id, v_bal_b, v_req.reward_amount, v_bal_b + v_req.reward_amount, 'request_accepted', p_request_id,
    'Realizaste solicitud: ' || COALESCE(v_at_name, '') || ' (+1.2× valor)');

  INSERT INTO action_records (user_id, action_type_id, performed_at, notes)
  VALUES (v_req.target_user_id, v_req.action_type_id, now(), 'Solicitud aceptada de ' || (SELECT name FROM users WHERE id = v_req.requester_id));
  UPDATE action_requests SET status = 'accepted', responded_at = now() WHERE id = p_request_id;
  UPDATE notifications SET read = true WHERE reference_id = p_request_id AND type = 'action_request';
END;
$$;

-- Rechazar solicitud: A gana 0.2 * points_value; balance_transaction + notificación a A
CREATE OR REPLACE FUNCTION public.reject_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_refund INTEGER;
  v_bal_a INTEGER;
  v_at_name TEXT;
  v_notif_id UUID;
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
  v_refund := (v_req.points_cost * 20) / 100;
  SELECT points_balance INTO v_bal_a FROM users WHERE id = v_req.requester_id;
  SELECT name INTO v_at_name FROM action_types WHERE id = v_req.action_type_id;

  UPDATE users SET points_balance = points_balance + v_refund, updated_at = now() WHERE id = v_req.requester_id;
  INSERT INTO balance_transactions (user_id, balance_before, delta, balance_after, event_type, reference_id, description)
  VALUES (v_req.requester_id, v_bal_a, v_refund, v_bal_a + v_refund, 'request_rejected', p_request_id,
    'Solicitud rechazada/cancelada: ' || COALESCE(v_at_name, '') || '. Has ganado ' || v_refund || ' pts.');

  UPDATE action_requests SET status = 'rejected', responded_at = now() WHERE id = p_request_id;
  UPDATE notifications SET read = true WHERE reference_id = p_request_id AND type = 'action_request';

  INSERT INTO notifications (user_id, type, reference_id)
  VALUES (v_req.requester_id, 'request_rejected', p_request_id);
END;
$$;

-- Expirar solicitudes: dar 0.2x al requester por cada una y notificar
CREATE OR REPLACE FUNCTION public.expire_pending_requests()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_refund INTEGER;
  v_bal INTEGER;
  v_at_name TEXT;
  v_count INTEGER := 0;
BEGIN
  FOR v_req IN
    SELECT * FROM action_requests
    WHERE status = 'pending' AND expires_at < now()
  LOOP
    v_refund := (v_req.points_cost * 20) / 100;
    SELECT points_balance INTO v_bal FROM users WHERE id = v_req.requester_id;
    SELECT name INTO v_at_name FROM action_types WHERE id = v_req.action_type_id;

    UPDATE users SET points_balance = points_balance + v_refund, updated_at = now() WHERE id = v_req.requester_id;
    INSERT INTO balance_transactions (user_id, balance_before, delta, balance_after, event_type, reference_id, description)
    VALUES (v_req.requester_id, v_bal, v_refund, v_bal + v_refund, 'request_expired', v_req.id,
      'Solicitud caducada: ' || COALESCE(v_at_name, '') || '. Has ganado ' || v_refund || ' pts.');

    UPDATE action_requests SET status = 'expired', responded_at = now() WHERE id = v_req.id;
    UPDATE notifications SET read = true WHERE reference_id = v_req.id AND type = 'action_request';
    INSERT INTO notifications (user_id, type, reference_id)
    VALUES (v_req.requester_id, 'request_expired', v_req.id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
