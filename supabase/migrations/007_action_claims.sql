-- Flujo "Acción realizada hacia otro": A dice que hizo la acción X hacia B; B confirma o cancela
CREATE TABLE public.action_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claimer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action_type_id UUID NOT NULL REFERENCES public.action_types(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT no_self_claim CHECK (claimer_id != target_user_id)
);

CREATE INDEX idx_action_claims_target_user_id ON public.action_claims(target_user_id);
CREATE INDEX idx_action_claims_claimer_id ON public.action_claims(claimer_id);
CREATE INDEX idx_action_claims_status ON public.action_claims(status);

ALTER TABLE public.action_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Action claims: ver como claimer o target" ON public.action_claims
  FOR SELECT USING (auth.uid() = claimer_id OR auth.uid() = target_user_id);
CREATE POLICY "Action claims: insertar como claimer" ON public.action_claims
  FOR INSERT WITH CHECK (auth.uid() = claimer_id);
CREATE POLICY "Action claims: actualizar como target" ON public.action_claims
  FOR UPDATE USING (auth.uid() = target_user_id);

-- RPC: Crear claim (A indica que realizó la acción hacia B)
CREATE OR REPLACE FUNCTION public.create_action_claim(
  p_action_type_id UUID,
  p_target_user_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimer_id UUID := auth.uid();
  v_at RECORD;
  v_claim_id UUID;
BEGIN
  IF v_claimer_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF v_claimer_id = p_target_user_id THEN
    RAISE EXCEPTION 'No puedes registrar una acción realizada hacia ti mismo';
  END IF;
  SELECT * INTO v_at FROM action_types WHERE id = p_action_type_id AND is_active = true;
  IF v_at.id IS NULL THEN
    RAISE EXCEPTION 'Acción no encontrada o inactiva';
  END IF;
  INSERT INTO action_claims (claimer_id, target_user_id, action_type_id, notes)
  VALUES (v_claimer_id, p_target_user_id, p_action_type_id, p_notes)
  RETURNING id INTO v_claim_id;
  INSERT INTO notifications (user_id, type, reference_id)
  VALUES (p_target_user_id, 'performed_for_request', v_claim_id);
  RETURN v_claim_id;
END;
$$;

-- RPC: Confirmar claim (B confirma → A gana 1.5 × valor)
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

  SELECT points_balance INTO v_bal_a FROM users WHERE id = v_claim.claimer_id;
  UPDATE users SET points_balance = points_balance + v_points_award, updated_at = now() WHERE id = v_claim.claimer_id;

  INSERT INTO balance_transactions (user_id, balance_before, delta, balance_after, event_type, reference_id, description)
  VALUES (v_claim.claimer_id, v_bal_a, v_points_award, v_bal_a + v_points_award, 'performed_for_confirmed', p_claim_id,
    COALESCE(v_at_name, '') || ' confirmada por quien la recibió (+1.5×)');

  UPDATE action_claims SET status = 'confirmed', responded_at = now() WHERE id = p_claim_id;
  INSERT INTO notifications (user_id, type, reference_id)
  VALUES (v_claim.claimer_id, 'performed_for_confirmed', p_claim_id);
END;
$$;

-- RPC: Cancelar claim (B cancela → solo notificación a A)
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
  UPDATE action_claims SET status = 'cancelled', responded_at = now() WHERE id = p_claim_id;
  INSERT INTO notifications (user_id, type, reference_id)
  VALUES (v_claim.claimer_id, 'performed_for_cancelled', p_claim_id);
END;
$$;
