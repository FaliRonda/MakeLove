-- MakeLove - RLS extra para que las misiones en pareja puedan leer action_records del compañero.

CREATE POLICY "Action records: ver pareja" ON public.action_records
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR (target_user_id IS NOT NULL AND auth.uid() = target_user_id)
  OR EXISTS (
    SELECT 1
    FROM public.couple_members cm_self
    JOIN public.couple_members cm_partner
      ON cm_partner.couple_id = cm_self.couple_id
    WHERE cm_self.user_id = auth.uid()
      AND cm_partner.user_id = public.action_records.user_id
  )
);

