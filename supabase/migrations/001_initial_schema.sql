-- MakeLove - Schema inicial
-- Ejecutar en Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum para status de solicitudes
CREATE TYPE request_status AS ENUM ('pending', 'accepted', 'rejected', 'expired');

-- Tabla users (perfil, vinculada a auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  points_balance INTEGER NOT NULL DEFAULT 100,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla action_types
CREATE TABLE public.action_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  points_value INTEGER NOT NULL CHECK (points_value > 0),
  reward_percentage INTEGER CHECK (reward_percentage IS NULL OR (reward_percentage >= 0 AND reward_percentage <= 100)),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla action_records
CREATE TABLE public.action_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action_type_id UUID NOT NULL REFERENCES public.action_types(id) ON DELETE CASCADE,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

-- Tabla action_requests
CREATE TABLE public.action_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action_type_id UUID NOT NULL REFERENCES public.action_types(id) ON DELETE CASCADE,
  status request_status NOT NULL DEFAULT 'pending',
  points_cost INTEGER NOT NULL,
  reward_amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  CONSTRAINT no_self_request CHECK (requester_id != target_user_id)
);

-- Tabla global_config
CREATE TABLE public.global_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Tabla notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  reference_id UUID,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_action_records_user_id ON public.action_records(user_id);
CREATE INDEX idx_action_records_action_type_id ON public.action_records(action_type_id);
CREATE INDEX idx_action_records_performed_at ON public.action_records(performed_at);
CREATE INDEX idx_action_requests_target_user_id ON public.action_requests(target_user_id);
CREATE INDEX idx_action_requests_requester_id ON public.action_requests(requester_id);
CREATE INDEX idx_action_requests_status ON public.action_requests(status);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);

-- Config global por defecto
INSERT INTO public.global_config (key, value) VALUES ('default_reward_percentage', '20');

-- Trigger: crear perfil de usuario al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Políticas users
CREATE POLICY "Users: ver propia fila" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users: admin ve todos" ON public.users FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Users: actualizar propia fila" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users: admin puede insertar/actualizar" ON public.users FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);

-- Políticas action_types
CREATE POLICY "Action types: todos leen" ON public.action_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Action types: solo admin escribe" ON public.action_types FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);

-- Políticas action_records
CREATE POLICY "Action records: ver propios" ON public.action_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Action records: admin ve todos" ON public.action_records FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Action records: insertar propios" ON public.action_records FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Políticas action_requests
CREATE POLICY "Action requests: ver como requester o target" ON public.action_requests FOR SELECT USING (
  auth.uid() = requester_id OR auth.uid() = target_user_id
);
CREATE POLICY "Action requests: insertar como requester" ON public.action_requests FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Action requests: actualizar como target" ON public.action_requests FOR UPDATE USING (auth.uid() = target_user_id);

-- Políticas global_config
CREATE POLICY "Global config: todos leen" ON public.global_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Global config: solo admin escribe" ON public.global_config FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);

-- Políticas notifications
CREATE POLICY "Notifications: ver propias" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Notifications: actualizar propias" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Notifications: insertar (desde RPC)" ON public.notifications FOR INSERT WITH CHECK (true);

-- RPC: Marcar acción realizada
CREATE OR REPLACE FUNCTION public.mark_action_done(
  p_action_type_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_points INTEGER;
  v_record_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  SELECT points_value INTO v_points FROM action_types WHERE id = p_action_type_id AND is_active = true;
  IF v_points IS NULL THEN
    RAISE EXCEPTION 'Acción no encontrada o inactiva';
  END IF;
  INSERT INTO action_records (user_id, action_type_id, notes)
  VALUES (v_user_id, p_action_type_id, p_notes)
  RETURNING id INTO v_record_id;
  UPDATE users SET points_balance = points_balance + v_points, updated_at = now() WHERE id = v_user_id;
  RETURN v_record_id;
END;
$$;

-- RPC: Expirar solicitudes pendientes
CREATE OR REPLACE FUNCTION public.expire_pending_requests()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE action_requests
  SET status = 'expired', responded_at = now()
  WHERE status = 'pending' AND expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- RPC: Aceptar solicitud
CREATE OR REPLACE FUNCTION public.accept_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  SELECT * INTO v_req FROM action_requests WHERE id = p_request_id AND target_user_id = auth.uid();
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Solicitud no encontrada o no autorizado';
  END IF;
  IF v_req.status != 'pending' THEN
    RAISE EXCEPTION 'La solicitud ya fue respondida';
  END IF;
  IF v_req.expires_at < now() THEN
    UPDATE action_requests SET status = 'expired', responded_at = now() WHERE id = p_request_id;
    RAISE EXCEPTION 'La solicitud ha caducado';
  END IF;
  UPDATE users SET points_balance = points_balance - v_req.points_cost, updated_at = now() WHERE id = v_req.requester_id;
  UPDATE users SET points_balance = points_balance + v_req.reward_amount, updated_at = now() WHERE id = v_req.target_user_id;
  INSERT INTO action_records (user_id, action_type_id, performed_at, notes)
  VALUES (v_req.target_user_id, v_req.action_type_id, now(), 'Solicitud aceptada de ' || (SELECT name FROM users WHERE id = v_req.requester_id));
  UPDATE action_requests SET status = 'accepted', responded_at = now() WHERE id = p_request_id;
  UPDATE notifications SET read = true WHERE reference_id = p_request_id AND type = 'action_request';
END;
$$;

-- RPC: Rechazar solicitud
CREATE OR REPLACE FUNCTION public.reject_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  SELECT * INTO v_req FROM action_requests WHERE id = p_request_id AND target_user_id = auth.uid();
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Solicitud no encontrada o no autorizado';
  END IF;
  IF v_req.status != 'pending' THEN
    RAISE EXCEPTION 'La solicitud ya fue respondida';
  END IF;
  IF v_req.expires_at < now() THEN
    UPDATE action_requests SET status = 'expired', responded_at = now() WHERE id = p_request_id;
    RAISE EXCEPTION 'La solicitud ha caducado';
  END IF;
  -- Compensación: requester recibe reward_amount
  UPDATE users SET points_balance = points_balance + v_req.reward_amount, updated_at = now() WHERE id = v_req.requester_id;
  UPDATE action_requests SET status = 'rejected', responded_at = now() WHERE id = p_request_id;
  UPDATE notifications SET read = true WHERE reference_id = p_request_id AND type = 'action_request';
END;
$$;

-- RPC: Crear solicitud (con validaciones)
CREATE OR REPLACE FUNCTION public.create_action_request(
  p_target_user_id UUID,
  p_action_type_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_id UUID := auth.uid();
  v_at RECORD;
  v_default_pct INTEGER;
  v_reward_pct INTEGER;
  v_points_cost INTEGER;
  v_reward_amount INTEGER;
  v_request_id UUID;
  v_requester_balance INTEGER;
  v_duplicate BOOLEAN;
BEGIN
  IF v_requester_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF v_requester_id = p_target_user_id THEN
    RAISE EXCEPTION 'No puedes solicitarte a ti mismo';
  END IF;
  SELECT * INTO v_at FROM action_types WHERE id = p_action_type_id AND is_active = true;
  IF v_at.id IS NULL THEN
    RAISE EXCEPTION 'Acción no encontrada o inactiva';
  END IF;
  SELECT points_balance INTO v_requester_balance FROM users WHERE id = v_requester_id;
  v_points_cost := v_at.points_value;
  IF v_requester_balance < v_points_cost THEN
    RAISE EXCEPTION 'Saldo insuficiente. Necesitas % puntos.', v_points_cost;
  END IF;
  SELECT value::INTEGER INTO v_default_pct FROM global_config WHERE key = 'default_reward_percentage' LIMIT 1;
  v_default_pct := COALESCE(v_default_pct, 20);
  v_reward_pct := COALESCE(v_at.reward_percentage, v_default_pct);
  v_reward_amount := (v_points_cost * v_reward_pct) / 100;
  SELECT EXISTS(
    SELECT 1 FROM action_requests
    WHERE requester_id = v_requester_id AND target_user_id = p_target_user_id
      AND action_type_id = p_action_type_id AND status = 'pending'
  ) INTO v_duplicate;
  IF v_duplicate THEN
    RAISE EXCEPTION 'Ya tienes una solicitud pendiente de esta acción para este usuario';
  END IF;
  INSERT INTO action_requests (requester_id, target_user_id, action_type_id, points_cost, reward_amount, expires_at)
  VALUES (v_requester_id, p_target_user_id, p_action_type_id, v_points_cost, v_reward_amount, now() + interval '12 hours')
  RETURNING id INTO v_request_id;
  INSERT INTO notifications (user_id, type, reference_id)
  VALUES (p_target_user_id, 'action_request', v_request_id);
  RETURN v_request_id;
END;
$$;
