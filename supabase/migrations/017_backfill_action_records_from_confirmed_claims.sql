-- Rellenar action_records para claims confirmados en el pasado (antes de que confirm_claim los creara).
-- Así las acciones confirmadas antiguas aparecen en "ha hecho" / "ha recibido" de los perfiles.

INSERT INTO public.action_records (user_id, action_type_id, performed_at, notes, target_user_id, record_claim_id)
SELECT
  c.claimer_id,
  c.action_type_id,
  COALESCE(c.responded_at, c.created_at),
  c.notes,
  c.target_user_id,
  c.id
FROM public.action_claims c
WHERE c.status = 'confirmed'
  AND NOT EXISTS (
    SELECT 1 FROM public.action_records ar WHERE ar.record_claim_id = c.id
  );
