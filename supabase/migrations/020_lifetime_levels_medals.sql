-- Puntos de vida (suma de todo lo ganado, sin restar gastos): 100 iniciales + suma de delta > 0 en balance_transactions.
-- Nivel: 1 + floor((lifetime - 1) / 100). Nivel 1 sin medalla; medallas por niveles 2..nivel actual.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS lifetime_points_earned integer NOT NULL DEFAULT 100;

-- Histórico: semilla 100 + créditos registrados
UPDATE public.users u
SET lifetime_points_earned = 100 + COALESCE(
  (SELECT SUM(bt.delta)::integer FROM public.balance_transactions bt WHERE bt.user_id = u.id AND bt.delta > 0),
  0
);

CREATE OR REPLACE FUNCTION public.balance_transactions_sync_lifetime()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.delta > 0 THEN
      UPDATE public.users
      SET lifetime_points_earned = lifetime_points_earned + NEW.delta,
          updated_at = now()
      WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.delta > 0 THEN
      UPDATE public.users
      SET lifetime_points_earned = GREATEST(100, lifetime_points_earned - OLD.delta),
          updated_at = now()
      WHERE id = OLD.user_id;
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE (poco frecuente; revierte el delta anterior y aplica el nuevo)
  IF OLD.user_id IS NOT DISTINCT FROM NEW.user_id THEN
    IF OLD.delta > 0 THEN
      UPDATE public.users
      SET lifetime_points_earned = GREATEST(100, lifetime_points_earned - OLD.delta),
          updated_at = now()
      WHERE id = OLD.user_id;
    END IF;
    IF NEW.delta > 0 THEN
      UPDATE public.users
      SET lifetime_points_earned = lifetime_points_earned + NEW.delta,
          updated_at = now()
      WHERE id = NEW.user_id;
    END IF;
  ELSE
    IF OLD.delta > 0 THEN
      UPDATE public.users
      SET lifetime_points_earned = GREATEST(100, lifetime_points_earned - OLD.delta),
          updated_at = now()
      WHERE id = OLD.user_id;
    END IF;
    IF NEW.delta > 0 THEN
      UPDATE public.users
      SET lifetime_points_earned = lifetime_points_earned + NEW.delta,
          updated_at = now()
      WHERE id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS balance_transactions_sync_lifetime ON public.balance_transactions;
CREATE TRIGGER balance_transactions_sync_lifetime
  AFTER INSERT OR UPDATE OR DELETE ON public.balance_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.balance_transactions_sync_lifetime();

-- Medallas por nivel (nivel >= 2); recompensa canjeada con la pareja
CREATE TABLE public.user_level_medals (
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  level integer NOT NULL CHECK (level >= 2),
  redeemed_at timestamptz NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, level)
);

CREATE INDEX idx_user_level_medals_user_id ON public.user_level_medals (user_id);

ALTER TABLE public.user_level_medals ENABLE ROW LEVEL SECURITY;

-- Lectura para perfil / pareja
CREATE POLICY "Level medals: autenticados leen"
  ON public.user_level_medals
  FOR SELECT
  TO authenticated
  USING (true);

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
        AND level <= 1 + GREATEST(u.lifetime_points_earned - 1, 0) / 100
    )
  );

CREATE POLICY "Level medals: actualizar propias"
  ON public.user_level_medals
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
