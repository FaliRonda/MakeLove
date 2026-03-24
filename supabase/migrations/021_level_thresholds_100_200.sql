-- Alinear desbloqueo de medallas con la nueva regla de niveles:
-- nivel 1 = 100–199 pts de vida, nivel 2 desde 200, nivel 3 desde 300, etc.
-- (misma fórmula que en src/lib/levels.ts)

DROP POLICY IF EXISTS "Level medals: insertar propias filas nivel desbloqueado"
  ON public.user_level_medals;

CREATE POLICY "Level medals: insertar propias filas nivel desbloqueado"
  ON public.user_level_medals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND level >= 2
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = user_id
        AND user_level_medals.level
          <= 1 + (GREATEST(u.lifetime_points_earned, 100) - 100) / 100
    )
  );
