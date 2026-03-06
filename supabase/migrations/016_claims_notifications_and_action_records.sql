-- 1) Quitar notificación "confirmar/cancelar" cuando se confirma o cancela el claim
-- 2) action_records: target_user_id y claim_id para acciones confirmadas (claims)
-- 3) confirm_claim: insertar action_record y descripción con nombre del que confirma
-- 4) RLS action_records: poder ver records donde eres target

ALTER TABLE public.action_records
  ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS record_claim_id UUID REFERENCES public.action_claims(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_action_records_target_user_id ON public.action_records(target_user_id);
CREATE INDEX IF NOT EXISTS idx_action_records_claim_id ON public.action_records(record_claim_id);

-- Permitir ver records donde eres actor (user_id) o receptor (target_user_id)
DROP POLICY IF EXISTS "Action records: ver propios" ON public.action_records;
CREATE POLICY "Action records: ver propios o como target" ON public.action_records
  FOR SELECT USING (
    auth.uid() = user_id
    OR (target_user_id IS NOT NULL AND auth.uid() = target_user_id)
  );

CREATE OR REPLACE FUNCTION public.confirm_claim(p_claim_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim RECORD;
  v_points_award INTEGER;
  v_bal_a INTEGER;
  v_at_name TEXT;
  v_target_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  SELECT * INTO v_claim FROM action_claims WHERE id = p_claim_id AND target_user_id = auth.uid();
  IF v_claim.id IS NULL THEN
    RAISE EXCEPTION 'Claim no encontrado o no autorizado';
  END IF;
  IF v_claim.status != 'pending' THEN
    RAISE EXCEPTION 'Este claim ya fue respondido';
  END IF;
  SELECT points_value, name INTO v_points_award, v_at_name FROM action_types WHERE id = v_claim.action_type_id;
  v_points_award := (v_points_award * 150) / 100;
  SELECT name INTO v_target_name FROM users WHERE id = v_claim.target_user_id;

  -- Quitar notificación de "confirmar/cancelar" para que no siga saliendo
  DELETE FROM notifications
  WHERE type = 'performed_for_request' AND reference_id = p_claim_id;

  SELECT points_balance INTO v_bal_a FROM users WHERE id = v_claim.claimer_id;
  UPDATE users SET points_balance = points_balance + v_points_award, updated_at = now() WHERE id = v_claim.claimer_id;

  INSERT INTO balance_transactions (user_id, balance_before, delta, balance_after, event_type, reference_id, description)
  VALUES (v_claim.claimer_id, v_bal_a, v_points_award, v_bal_a + v_points_award, 'performed_for_confirmed', p_claim_id,
    COALESCE(v_at_name, '') || ' confirmada por ' || COALESCE(v_target_name, 'quien la recibió') || ' (+1.5×)');

  UPDATE action_claims SET status = 'confirmed', responded_at = now() WHERE id = p_claim_id;

  -- Registrar la acción en historial de ambos perfiles (ha hecho / ha recibido)
  INSERT INTO action_records (user_id, action_type_id, performed_at, notes, target_user_id, record_claim_id)
  VALUES (v_claim.claimer_id, v_claim.action_type_id, now(), v_claim.notes, v_claim.target_user_id, p_claim_id);

  INSERT INTO notifications (user_id, type, reference_id)
  VALUES (v_claim.claimer_id, 'performed_for_confirmed', p_claim_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_claim(p_claim_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  SELECT * INTO v_claim FROM action_claims WHERE id = p_claim_id AND target_user_id = auth.uid();
  IF v_claim.id IS NULL THEN
    RAISE EXCEPTION 'Claim no encontrado o no autorizado';
  END IF;
  IF v_claim.status != 'pending' THEN
    RAISE EXCEPTION 'Este claim ya fue respondido';
  END IF;
  DELETE FROM notifications
  WHERE type = 'performed_for_request' AND reference_id = p_claim_id;
  UPDATE action_claims SET status = 'cancelled', responded_at = now() WHERE id = p_claim_id;
  INSERT INTO notifications (user_id, type, reference_id)
  VALUES (v_claim.claimer_id, 'performed_for_cancelled', p_claim_id);
END;
$$;
