-- Objetivo semanal colaborativo: 4 action_records (lunes–domingo, zona Europe/Madrid) → cada usuario puede reclamar +20 pts.

CREATE TABLE public.weekly_goal_claims (
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  week_monday date NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_monday)
);

CREATE INDEX idx_weekly_goal_claims_week ON public.weekly_goal_claims (week_monday);

ALTER TABLE public.weekly_goal_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Weekly goal claims: ver propias"
  ON public.weekly_goal_claims
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Lunes de la semana actual (calendario ISO, alineado con Madrid).
CREATE OR REPLACE FUNCTION public._current_week_monday_madrid ()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (
    (timezone('Europe/Madrid', now()))::date
    - (EXTRACT(ISODOW FROM timezone('Europe/Madrid', now()))::integer - 1)
  );
$$;

-- Inicio lunes 00:00 Madrid y fin siguiente lunes 00:00 Madrid (exclusivo).
CREATE OR REPLACE FUNCTION public._week_bounds_madrid (p_monday date)
RETURNS TABLE (ts_start timestamptz, ts_end timestamptz)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    (p_monday::timestamp AT TIME ZONE 'Europe/Madrid'),
    ((p_monday + interval '7 days')::timestamp AT TIME ZONE 'Europe/Madrid');
$$;

CREATE OR REPLACE FUNCTION public.get_weekly_collab_goal_state ()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_monday date;
  v_start timestamptz;
  v_end timestamptz;
  v_count integer;
  v_claimed boolean;
BEGIN
  IF auth.uid () IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  v_monday := public._current_week_monday_madrid ();
  SELECT ts_start, ts_end INTO v_start, v_end FROM public._week_bounds_madrid (v_monday);

  SELECT COUNT(*)::integer INTO v_count
  FROM public.action_records
  WHERE performed_at >= v_start AND performed_at < v_end;

  SELECT EXISTS (
    SELECT 1
    FROM public.weekly_goal_claims w
    WHERE w.user_id = auth.uid () AND w.week_monday = v_monday
  ) INTO v_claimed;

  RETURN jsonb_build_object(
    'week_monday', v_monday,
    'action_count', v_count,
    'goal', 4,
    'reward_points', 20,
    'claimed', v_claimed,
    'can_claim', (v_count >= 4 AND NOT v_claimed)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_weekly_collab_reward ()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid ();
  v_monday date;
  v_start timestamptz;
  v_end timestamptz;
  v_count integer;
  v_bal integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  v_monday := public._current_week_monday_madrid ();
  SELECT ts_start, ts_end INTO v_start, v_end FROM public._week_bounds_madrid (v_monday);

  SELECT COUNT(*)::integer INTO v_count
  FROM public.action_records
  WHERE performed_at >= v_start AND performed_at < v_end;

  IF v_count < 4 THEN
    RAISE EXCEPTION 'Aún no habéis completado el objetivo de 4 acciones esta semana';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.weekly_goal_claims w
    WHERE w.user_id = v_uid AND w.week_monday = v_monday
  ) THEN
    RAISE EXCEPTION 'Ya has reclamado la recompensa de esta semana';
  END IF;

  SELECT points_balance INTO v_bal FROM public.users WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  UPDATE public.users
  SET points_balance = v_bal + 20,
      updated_at = now()
  WHERE id = v_uid;

  INSERT INTO public.balance_transactions (
    user_id,
    balance_before,
    delta,
    balance_after,
    event_type,
    description
  )
  VALUES (
    v_uid,
    v_bal,
    20,
    v_bal + 20,
    'weekly_collab_reward',
    'Recompensa objetivo semanal colaborativo (+20 pts)'
  );

  INSERT INTO public.weekly_goal_claims (user_id, week_monday)
  VALUES (v_uid, v_monday);
END;
$$;

REVOKE ALL ON FUNCTION public._current_week_monday_madrid () FROM PUBLIC;
REVOKE ALL ON FUNCTION public._week_bounds_madrid (date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_weekly_collab_goal_state () FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_weekly_collab_reward () FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_weekly_collab_goal_state () TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_weekly_collab_reward () TO authenticated;
