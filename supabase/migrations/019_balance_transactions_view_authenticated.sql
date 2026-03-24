-- Permitir que cualquier usuario autenticado consulte el historial de saldo
-- de otros perfiles (balance_transactions).
--
-- El front ya filtra por `user_id=...` al consultar, así que solo se retornan
-- las transacciones del perfil solicitado.

CREATE POLICY "Balance transactions: ver cualquier usuario (autenticado)"
  ON public.balance_transactions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

