-- Corregir recursión infinita en RLS de users: las políticas "admin" hacían
-- SELECT FROM users dentro de una política sobre users. Usamos una función
-- SECURITY DEFINER para que la consulta corra como el propietario (sin RLS).

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true);
$$;

-- Recrear políticas que causaban recursión usando la función
DROP POLICY IF EXISTS "Users: admin ve todos" ON public.users;
DROP POLICY IF EXISTS "Users: admin puede insertar/actualizar" ON public.users;

CREATE POLICY "Users: admin ve todos" ON public.users FOR SELECT USING (
  public.current_user_is_admin()
);

CREATE POLICY "Users: admin puede insertar/actualizar" ON public.users FOR ALL USING (
  public.current_user_is_admin()
);
