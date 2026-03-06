-- Notificar también al que confirma/cancela (target) con texto en primera persona:
-- "Has confirmado que X te ha hecho un Y" / "Has cancelado el registro de que X te hizo un Y"

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

  DELETE FROM notifications
  WHERE type = 'performed_for_request' AND reference_id = p_claim_id;

  SELECT points_balance INTO v_bal_a FROM users WHERE id = v_claim.claimer_id;
  UPDATE users SET points_balance = points_balance + v_points_award, updated_at = now() WHERE id = v_claim.claimer_id;

  INSERT INTO balance_transactions (user_id, balance_before, delta, balance_after, event_type, reference_id, description)
  VALUES (v_claim.claimer_id, v_bal_a, v_points_award, v_bal_a + v_points_award, 'performed_for_confirmed', p_claim_id,
    COALESCE(v_at_name, '') || ' confirmada por ' || COALESCE(v_target_name, 'quien la recibió') || ' (+1.5×)');

  UPDATE action_claims SET status = 'confirmed', responded_at = now() WHERE id = p_claim_id;

  INSERT INTO action_records (user_id, action_type_id, performed_at, notes, target_user_id, record_claim_id)
  VALUES (v_claim.claimer_id, v_claim.action_type_id, now(), v_claim.notes, v_claim.target_user_id, p_claim_id);

  INSERT INTO notifications (user_id, type, reference_id)
  VALUES (v_claim.claimer_id, 'performed_for_confirmed', p_claim_id);

  -- Quien confirma ve en su lista: "Has confirmado que X te ha hecho un Y"
  INSERT INTO notifications (user_id, type, reference_id)
  VALUES (v_claim.target_user_id, 'performed_for_you_confirmed', p_claim_id);
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

  -- Quien cancela/deniega ve en su lista: "Has cancelado el registro de que X te hizo un Y"
  INSERT INTO notifications (user_id, type, reference_id)
  VALUES (v_claim.target_user_id, 'performed_for_you_cancelled', p_claim_id);
END;
$$;
