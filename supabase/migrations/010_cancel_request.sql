-- Añadir estado 'cancelled' para solicitudes canceladas por el creador (sin devolver puntos)
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Cancelar solicitud: solo el creador (requester), sin modificar puntos
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
  IF v_req.status != 'pending' THEN
    RAISE EXCEPTION 'La solicitud ya fue respondida o cancelada';
  END IF;
  IF v_req.expires_at < now() THEN
    UPDATE action_requests SET status = 'expired', responded_at = now() WHERE id = p_request_id;
    RAISE EXCEPTION 'La solicitud ha caducado';
  END IF;

  -- Solo actualizar estado; no se modifican puntos de nadie
  UPDATE action_requests SET status = 'cancelled', responded_at = now() WHERE id = p_request_id;
  UPDATE notifications SET read = true WHERE reference_id = p_request_id AND type = 'action_request';
END;
$$;
