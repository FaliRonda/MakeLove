-- Elimina reward_percentage (legado del MVP).
-- Las solicitudes usan 1,2× / 0,2× fijos desde la migración 006 (create_action_request).

DELETE FROM public.global_config
WHERE key = 'default_reward_percentage';

ALTER TABLE public.action_types
  DROP COLUMN IF EXISTS reward_percentage;
