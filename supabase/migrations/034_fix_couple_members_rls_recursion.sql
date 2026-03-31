-- Evita "infinite recursion detected in policy for relation 'couple_members'":
-- la política de SELECT en couple_members consultaba de nuevo couple_members,
-- y al evaluar p. ej. user_inventory (pareja) Postgres reentraba sin fin.

CREATE OR REPLACE FUNCTION public.couple_members_couple_has_user(
  p_couple_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.couple_members cm
    WHERE cm.couple_id = p_couple_id
      AND cm.user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.couple_members_couple_has_user(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.couple_members_couple_has_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.couple_members_couple_has_user(uuid, uuid) TO service_role;

DROP POLICY IF EXISTS "couple_members: ver tu pareja" ON public.couple_members;

CREATE POLICY "couple_members: ver tu pareja" ON public.couple_members
  FOR SELECT
  TO authenticated
  USING (public.couple_members_couple_has_user(couple_id, auth.uid()));
