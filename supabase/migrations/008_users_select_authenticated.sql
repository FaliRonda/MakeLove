-- Permitir que cualquier usuario autenticado pueda leer la lista de usuarios
-- (necesario para elegir "hacia quién" en acción realizada y en nueva solicitud)
CREATE POLICY "Users: autenticados leen todos" ON public.users
  FOR SELECT TO authenticated
  USING (true);
