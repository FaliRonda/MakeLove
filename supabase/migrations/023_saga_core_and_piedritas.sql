-- MakeLove - Historia ("Historias de amor") + moneda "Piedritas"
-- 1) Ejecutar en Supabase SQL Editor.

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========
-- Utilities
-- =========

-- Niveles desde "lifetime_points_earned" (misma fórmula que src/lib/levels.ts)
-- nivel = 1 + floor((lifetime - 1) / 100)
CREATE OR REPLACE FUNCTION public._level_from_lifetime_points(p_lifetime_points integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_lifetime_points IS NULL THEN 1
    WHEN p_lifetime_points < 100 THEN 1
    ELSE 1 + FLOOR((p_lifetime_points - 1) / 100)
  END
$$;

-- Bounds en Europe/Madrid (fin de día inclusivo)
-- Retorna [ts_start, ts_end_exclusive)
CREATE OR REPLACE FUNCTION public._madrid_day_start(p_date date)
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT (p_date::timestamp AT TIME ZONE 'Europe/Madrid')
$$;

CREATE OR REPLACE FUNCTION public._madrid_day_end_exclusive(p_date date)
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT ((p_date + interval '1 day')::timestamp AT TIME ZONE 'Europe/Madrid')
$$;

-- =========
-- Parejas
-- =========

CREATE TABLE public.couples (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.couple_members (
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (couple_id, user_id),
  -- Un usuario solo puede estar en una pareja.
  UNIQUE (user_id)
);

-- RLS
ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_members ENABLE ROW LEVEL SECURITY;

-- Helper: pareja activa de un usuario (devuelve el couple_id y el partner_id)
-- Si no existe pareja, devuelve NULLs.
CREATE OR REPLACE FUNCTION public.get_active_couple_partner(p_user_id uuid)
RETURNS TABLE (couple_id uuid, partner_user_id uuid)
LANGUAGE sql
STABLE
AS $$
  SELECT
    cm.couple_id,
    CASE WHEN cm.user_id = p_user_id THEN
      cm2.user_id
    ELSE
      cm.user_id
    END AS partner_user_id
  FROM public.couple_members cm
  JOIN public.couple_members cm2
    ON cm2.couple_id = cm.couple_id
   AND cm2.user_id <> p_user_id
  WHERE cm.user_id = p_user_id
  LIMIT 1
$$;

-- Lectura: si eres miembro, puedes ver a tu pareja (para calcular misiones en pareja).
CREATE POLICY "couple_members: ver tu pareja" ON public.couple_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.couple_members cm2
    WHERE cm2.couple_id = couple_members.couple_id
      AND cm2.user_id = auth.uid()
  )
);

-- couples: permitir leer el couple si eres miembro
CREATE POLICY "couples: ver tu pareja" ON public.couples
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.couple_members cm
    WHERE cm.couple_id = couples.id
      AND cm.user_id = auth.uid()
  )
);

-- ============
-- Historia (historias)
-- ============

CREATE TYPE story_status AS ENUM ('planned', 'active', 'closed');
CREATE TYPE mission_target_type AS ENUM ('individual', 'couple');
CREATE TYPE mission_metric_type AS ENUM (
  'actions_done',
  'requests_sent_confirmed',
  'requests_received_confirmed',
  'points_gained',
  'levels_gained'
);

CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  start_date date NOT NULL,
  end_date date NOT NULL,
  status story_status NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stories_dates ON public.stories(start_date, end_date);

CREATE TABLE public.chapters (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_number integer NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chapters_unique_order UNIQUE (story_id, order_number)
);

CREATE INDEX idx_chapters_story_order ON public.chapters(story_id, order_number);

CREATE TABLE public.missions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  order_number integer NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  target_type mission_target_type NOT NULL DEFAULT 'individual',
  reward_piedritas integer NOT NULL DEFAULT 0 CHECK (reward_piedritas >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT missions_unique_order UNIQUE (chapter_id, order_number)
);

CREATE INDEX idx_missions_chapter_order ON public.missions(chapter_id, order_number);

-- Cada misión puede tener 1..N requisitos; la completitud es AND sobre todos.
CREATE TABLE public.mission_requirements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  metric_type mission_metric_type NOT NULL,
  required_amount integer NOT NULL CHECK (required_amount > 0)
);

CREATE INDEX idx_mission_requirements_mission ON public.mission_requirements(mission_id);

-- Claim por usuario (aunque la misión sea "en pareja", se reclama por separado)
CREATE TABLE public.user_story_mission_claims (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mission_id)
);

CREATE INDEX idx_user_story_mission_claims_user ON public.user_story_mission_claims(user_id);

-- RLS saga
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_story_mission_claims ENABLE ROW LEVEL SECURITY;

-- Lectura: usuarios autenticados leen la estructura de saga.
CREATE POLICY "stories: autenticados leen" ON public.stories
FOR SELECT TO authenticated
USING (true);
CREATE POLICY "chapters: autenticados leen" ON public.chapters
FOR SELECT TO authenticated
USING (true);
CREATE POLICY "missions: autenticados leen" ON public.missions
FOR SELECT TO authenticated
USING (true);
CREATE POLICY "mission_requirements: autenticados leen" ON public.mission_requirements
FOR SELECT TO authenticated
USING (true);

-- Claims: solo leer propias; insertar mediante RPC (pero permitimos con RLS en base a user_id)
CREATE POLICY "user_story_mission_claims: leer propias" ON public.user_story_mission_claims
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "user_story_mission_claims: insertar propias" ON public.user_story_mission_claims
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =========
-- Piedritas
-- =========

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS piedritas_balance integer NOT NULL DEFAULT 0;

CREATE TABLE public.piedritas_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  balance_before integer NOT NULL,
  delta integer NOT NULL,
  balance_after integer NOT NULL,
  event_type text NOT NULL,
  reference_id uuid,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_piedritas_transactions_user_id ON public.piedritas_transactions(user_id);
CREATE INDEX idx_piedritas_transactions_created_at ON public.piedritas_transactions(created_at DESC);

ALTER TABLE public.piedritas_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "piedritas_transactions: ver propias" ON public.piedritas_transactions
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- ==================
-- Admin: asociar pareja
-- ==================

-- RPC: reemplazo de pareja (un usuario solo pertenece a una pareja)
-- Admin inserta una pareja para dos usuarios.
CREATE OR REPLACE FUNCTION public.admin_set_couple(
  p_user_a_id uuid,
  p_user_b_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_couple_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_uid AND u.is_admin = true) THEN
    RAISE EXCEPTION 'No eres admin';
  END IF;

  IF p_user_a_id = p_user_b_id THEN
    RAISE EXCEPTION 'No puedes asociarte a ti mismo';
  END IF;

  -- Reemplazar: borrar membresías existentes de esos usuarios
  DELETE FROM public.couple_members cm
  WHERE cm.user_id IN (p_user_a_id, p_user_b_id);

  -- Recolectar couples vacíos (si se quedaron sin miembros)
  DELETE FROM public.couples c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.couple_members cm WHERE cm.couple_id = c.id
  );

  INSERT INTO public.couples DEFAULT VALUES
  RETURNING id INTO v_couple_id;

  INSERT INTO public.couple_members (couple_id, user_id)
  VALUES (v_couple_id, p_user_a_id),
         (v_couple_id, p_user_b_id);

  RETURN v_couple_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_couple(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_couple(uuid, uuid) TO authenticated;

-- ======================
-- Cálculo de progreso
-- ======================

-- Devuelve progreso numérico para una misión (primer requisito) y completitud.
-- La UI puede iterar por requisitos, pero para MVP devolvemos "is_complete".
CREATE OR REPLACE FUNCTION public._mission_progress_as_of(
  p_user_id uuid,
  p_mission_id uuid,
  p_now timestamptz
)
RETURNS TABLE (
  is_complete boolean,
  progress_value integer,
  progress_target integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mission public.missions%ROWTYPE;
  v_chapters record;
  v_story record;
  v_member_ids uuid[];
  v_progress_value integer := 0;
  v_progress_target integer := 0;
  v_req record;
  v_as_of timestamptz;
  v_ts_start timestamptz;
  v_ts_end_exclusive timestamptz;
  v_ok boolean := true;
BEGIN
  SELECT * INTO v_mission FROM public.missions m WHERE m.id = p_mission_id;
  IF v_mission.id IS NULL THEN
    RAISE EXCEPTION 'Misión no encontrada';
  END IF;

  SELECT c.*, s.start_date AS story_start_date, s.end_date AS story_end_date
  INTO v_chapters
  FROM public.chapters c
  JOIN public.stories s ON s.id = c.story_id
  WHERE c.id = v_mission.chapter_id;

  -- Bounds del capítulo (Europe/Madrid, fin de día inclusivo)
  v_ts_start := public._madrid_day_start(v_chapters.start_date);
  v_ts_end_exclusive := public._madrid_day_end_exclusive(v_chapters.end_date);
  v_as_of := LEAST(p_now, v_ts_end_exclusive);

  IF v_mission.target_type = 'couple' THEN
    SELECT array_agg(cm.user_id ORDER BY cm.user_id) INTO v_member_ids
    FROM public.couple_members cm
    JOIN public.couple_members cm2 ON cm2.couple_id = cm.couple_id
    WHERE cm2.user_id = p_user_id;

    IF v_member_ids IS NULL OR array_length(v_member_ids, 1) <> 2 THEN
      -- Sin pareja activa => no completa
      is_complete := false;
      progress_value := 0;
      progress_target := 0;
      RETURN;
    END IF;
  ELSE
    v_member_ids := ARRAY[p_user_id];
  END IF;

  -- Evaluar todos los requisitos (AND)
  -- Para MVP, calculamos "progress_value/target" en función del primer requisito evaluado.
  FOR v_req IN
    SELECT mr.metric_type, mr.required_amount, mr.id
    FROM public.mission_requirements mr
    WHERE mr.mission_id = p_mission_id
    ORDER BY mr.id
  LOOP
    v_progress_target := v_req.required_amount;

    IF v_req.metric_type = 'actions_done' THEN
      -- "Acciones hechas" SOLO las marcadas como hechas (no provenientes de requests/claims).
      IF v_mission.target_type = 'individual' THEN
        SELECT COUNT(*)::integer INTO v_progress_value
        FROM public.action_records ar
        WHERE ar.user_id = p_user_id
          AND ar.request_id IS NULL
          AND ar.record_claim_id IS NULL
          AND ar.performed_at >= v_ts_start AND ar.performed_at < v_as_of;
      ELSE
        SELECT COUNT(*)::integer INTO v_progress_value
        FROM public.action_records ar
        WHERE ar.user_id = ANY (v_member_ids)
          AND ar.request_id IS NULL
          AND ar.record_claim_id IS NULL
          AND ar.performed_at >= v_ts_start AND ar.performed_at < v_as_of;
      END IF;

    ELSIF v_req.metric_type = 'requests_sent_confirmed' THEN
      -- Solicitudes confirmadas: action_requests.status='accepted' y se cuentan en responded_at.
      IF v_mission.target_type = 'individual' THEN
        SELECT COUNT(*)::integer INTO v_progress_value
        FROM public.action_requests r
        WHERE r.status = 'accepted'
          AND r.requester_id = p_user_id
          AND r.responded_at IS NOT NULL
          AND r.responded_at >= v_ts_start AND r.responded_at < v_as_of;
      ELSE
        -- Pareja: suma de ambos
        SELECT COUNT(*)::integer INTO v_progress_value
        FROM public.action_requests r
        WHERE r.status = 'accepted'
          AND r.responded_at IS NOT NULL
          AND r.requester_id = ANY (v_member_ids)
          AND r.target_user_id = ANY (v_member_ids)
          AND r.responded_at >= v_ts_start AND r.responded_at < v_as_of;
      END IF;

    ELSIF v_req.metric_type = 'requests_received_confirmed' THEN
      IF v_mission.target_type = 'individual' THEN
        SELECT COUNT(*)::integer INTO v_progress_value
        FROM public.action_requests r
        WHERE r.status = 'accepted'
          AND r.target_user_id = p_user_id
          AND r.responded_at IS NOT NULL
          AND r.responded_at >= v_ts_start AND r.responded_at < v_as_of;
      ELSE
        SELECT COUNT(*)::integer INTO v_progress_value
        FROM public.action_requests r
        WHERE r.status = 'accepted'
          AND r.responded_at IS NOT NULL
          AND r.requester_id = ANY (v_member_ids)
          AND r.target_user_id = ANY (v_member_ids)
          AND r.responded_at >= v_ts_start AND r.responded_at < v_as_of;
      END IF;

    ELSIF v_req.metric_type = 'points_gained' THEN
      IF v_mission.target_type = 'individual' THEN
        SELECT COALESCE(SUM(bt.delta), 0)::integer INTO v_progress_value
        FROM public.balance_transactions bt
        WHERE bt.user_id = p_user_id
          AND bt.delta > 0
          AND bt.created_at >= v_ts_start AND bt.created_at < v_as_of;
      ELSE
        SELECT COALESCE(SUM(bt.delta), 0)::integer INTO v_progress_value
        FROM public.balance_transactions bt
        WHERE bt.user_id = ANY (v_member_ids)
          AND bt.delta > 0
          AND bt.created_at >= v_ts_start AND bt.created_at < v_as_of;
      END IF;

    ELSIF v_req.metric_type = 'levels_gained' THEN
      -- Niveles ganados en [start, as_of). Usamos lifetime_points_earned actual
      -- y la restamos con el total de deltas positivos en la ventana.
      IF v_mission.target_type = 'individual' THEN
        SELECT lifetime_points_earned INTO v_progress_value
        FROM public.users u
        WHERE u.id = p_user_id;

        -- lifetime_at_start = current_lifetime - sum_positive_deltas(start, as_of)
        -- niveles_gained = level(current) - level(lifetime_at_start)
        WITH sums AS (
          SELECT COALESCE(SUM(bt.delta), 0)::integer AS sum_pos
          FROM public.balance_transactions bt
          WHERE bt.user_id = p_user_id
            AND bt.delta > 0
            AND bt.created_at >= v_ts_start AND bt.created_at < v_as_of
        )
        SELECT (
          public._level_from_lifetime_points(u_l.current_lifetime)
          - public._level_from_lifetime_points(u_l.current_lifetime - s.sum_pos)
        )::integer
        INTO v_progress_value
        FROM (
          SELECT u.lifetime_points_earned AS current_lifetime
          FROM public.users u
          WHERE u.id = p_user_id
        ) u_l
        CROSS JOIN sums s;

      ELSE
        -- Pareja: "sube N cada uno" => ambos deben cumplir.
        -- Definimos progress_value como el mínimo de niveles ganados entre ambos.
        WITH sums AS (
          SELECT
            u.id AS user_id,
            u.lifetime_points_earned AS current_lifetime,
            COALESCE(SUM(bt.delta), 0)::integer AS sum_pos
          FROM public.users u
          LEFT JOIN public.balance_transactions bt
            ON bt.user_id = u.id
           AND bt.delta > 0
           AND bt.created_at >= v_ts_start AND bt.created_at < v_as_of
          WHERE u.id = ANY (v_member_ids)
          GROUP BY u.id, u.lifetime_points_earned
        ),
        levels AS (
          SELECT
            public._level_from_lifetime_points(current_lifetime)
            - public._level_from_lifetime_points(current_lifetime - sum_pos) AS levels_gained
          FROM sums
        )
        SELECT COALESCE(MIN(levels_gained), 0)::integer INTO v_progress_value
        FROM levels;
      END IF;

    ELSE
      v_progress_value := 0;
    END IF;

    -- Completitud requisito actual
    IF v_progress_value < v_progress_target THEN
      v_ok := false;
    END IF;
  END LOOP;

  is_complete := v_ok;
  progress_value := v_progress_value;
  progress_target := v_progress_target;
  RETURN;
END;
$$;

-- ==============
-- Estado de misión
-- ==============

CREATE OR REPLACE FUNCTION public.get_active_story_state(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_today date := (timezone('Europe/Madrid', v_now))::date;
  v_story record;
  v_chapter record;
  v_partner uuid;
BEGIN
  SELECT * INTO v_story
  FROM public.stories s
  WHERE s.start_date <= v_today AND s.end_date >= v_today
  ORDER BY s.start_date ASC
  LIMIT 1;

  IF v_story.id IS NULL THEN
    -- Si no hay historia activa, devolvemos la próxima planificada
    SELECT * INTO v_story
    FROM public.stories s
    WHERE s.start_date > v_today
    ORDER BY s.start_date ASC
    LIMIT 1;
  END IF;

  -- partner opcional (puede ser null si no hay pareja)
  SELECT partner_user_id INTO v_partner
  FROM public.get_active_couple_partner(p_user_id) t
  LIMIT 1;

  -- Estructura base
  RETURN jsonb_build_object(
    'as_of', v_now,
    'user_id', p_user_id,
    'partner_user_id', v_partner,
    'story', CASE WHEN v_story.id IS NULL THEN null ELSE jsonb_build_object(
      'id', v_story.id,
      'name', v_story.name,
      'description', v_story.description,
      'start_date', v_story.start_date,
      'end_date', v_story.end_date
    ) END,
    'chapters', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'order_number', c.order_number,
          'start_date', c.start_date,
          'end_date', c.end_date,
          'missions', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', m.id,
                'order_number', m.order_number,
                'title', m.title,
                'target_type', m.target_type,
                'reward_piedritas', m.reward_piedritas,
                'claimed', EXISTS(
                  SELECT 1
                  FROM public.user_story_mission_claims cm
                  WHERE cm.user_id = p_user_id AND cm.mission_id = m.id
                ),
                'progress', public._mission_progress_as_of(p_user_id, m.id, v_now)
              )
              ORDER BY m.order_number ASC
            )
            FROM public.missions m
            WHERE m.chapter_id = c.id
          )
        )
        ORDER BY c.order_number ASC
      )
      FROM public.chapters c
      WHERE c.story_id = v_story.id
    ), '[]'::jsonb)
  );
END;
$$;

-- ==============
-- Claim misión
-- ==============

CREATE OR REPLACE FUNCTION public.claim_story_mission_reward(
  p_user_id uuid,
  p_mission_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_mission public.missions%ROWTYPE;
  v_chapter public.chapters%ROWTYPE;
  v_story public.stories%ROWTYPE;
  v_ts_end_exclusive timestamptz;
  v_is_complete boolean;
  v_reward integer;
  v_couple_partner uuid;
  v_balance_before integer;
  v_balance_after integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'No user_id';
  END IF;

  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    -- Evita claims de otro usuario desde cliente
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_mission FROM public.missions m WHERE m.id = p_mission_id;
  IF v_mission.id IS NULL THEN
    RAISE EXCEPTION 'Misión no encontrada';
  END IF;

  SELECT * INTO v_chapter FROM public.chapters c WHERE c.id = v_mission.chapter_id;
  SELECT * INTO v_story FROM public.stories s WHERE s.id = v_chapter.story_id;

  -- Expira al terminar el capítulo (fin de día inclusivo)
  v_ts_end_exclusive := public._madrid_day_end_exclusive(v_chapter.end_date);
  IF v_now >= v_ts_end_exclusive THEN
    RAISE EXCEPTION 'La misión ha expirado';
  END IF;

  -- Si la misión es en pareja: debe existir pareja activa
  IF v_mission.target_type = 'couple' THEN
    SELECT partner_user_id INTO v_couple_partner
    FROM public.get_active_couple_partner(p_user_id);
    IF v_couple_partner IS NULL THEN
      RAISE EXCEPTION 'La misión es en pareja pero no tienes pareja activa';
    END IF;
  END IF;

  -- Claim único por usuario
  IF EXISTS (
    SELECT 1 FROM public.user_story_mission_claims cm
    WHERE cm.user_id = p_user_id AND cm.mission_id = p_mission_id
  ) THEN
    RAISE EXCEPTION 'Ya has reclamado esta misión';
  END IF;

  SELECT progress.is_complete, m.reward_piedritas
  INTO v_is_complete, v_reward
  FROM public._mission_progress_as_of(p_user_id, p_mission_id, v_now) progress
  JOIN public.missions m ON m.id = p_mission_id
  LIMIT 1;

  IF NOT v_is_complete THEN
    RAISE EXCEPTION 'Aún no has completado los requisitos de la misión';
  END IF;

  -- Transferir Piedritas (ledger)
  SELECT piedritas_balance INTO v_balance_before
  FROM public.users u
  WHERE u.id = p_user_id
  FOR UPDATE;

  v_balance_after := v_balance_before + COALESCE(v_reward, 0);

  UPDATE public.users
  SET piedritas_balance = v_balance_after,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.piedritas_transactions(
    user_id, balance_before, delta, balance_after,
    event_type, reference_id, description
  ) VALUES (
    p_user_id, v_balance_before, v_reward, v_balance_after,
    'story_mission_claim',
    p_mission_id,
    'Recompensa misión: ' || v_mission.title
  );

  INSERT INTO public.user_story_mission_claims(user_id, mission_id)
  VALUES (p_user_id, p_mission_id);

  RETURN v_reward;
END;
$$;

REVOKE ALL ON FUNCTION public.get_active_story_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_story_state(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.claim_story_mission_reward(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_story_mission_reward(uuid, uuid) TO authenticated;

