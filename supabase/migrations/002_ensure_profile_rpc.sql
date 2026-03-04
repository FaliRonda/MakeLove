-- RPC: Crear perfil en public.users si no existe (para usuarios creados antes del trigger)
-- Útil cuando el trigger on_auth_user_created no se ejecutó (ej. migración aplicada después)
CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID := auth.uid();
  v_email TEXT;
  v_name TEXT;
BEGIN
  IF v_id IS NULL THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM users WHERE id = v_id) THEN RETURN v_id; END IF;
  SELECT email, COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1))
  INTO v_email, v_name
  FROM auth.users WHERE id = v_id;
  INSERT INTO users (id, name, email) VALUES (v_id, v_name, v_email);
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;
