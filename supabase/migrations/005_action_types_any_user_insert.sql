-- Permitir que cualquier usuario autenticado cree (INSERT) tipos de acción.
-- UPDATE/DELETE siguen restringidos al admin por la política existente.
CREATE POLICY "Action types: usuarios pueden insertar" ON public.action_types
  FOR INSERT TO authenticated WITH CHECK (true);
