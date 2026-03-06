-- =============================================================================
-- Reset: eliminar acciones y datos relacionados, MANTENER USUARIOS
-- =============================================================================
-- Qué hace:
--   1. Borra en orden seguro (respetando FKs): balance_transactions, notifications,
--      action_claims, action_records, action_requests.
--   2. Deja intactas: public.users, public.action_types, public.global_config.
--   3. Restaura points_balance de todos los usuarios al valor por defecto (100).
--
-- Cómo usarlo:
--   - Abre el SQL Editor de tu proyecto en Supabase.
--   - Pega este script. Si quieres poder deshacer, descomenta BEGIN/ROLLBACK y
--     ejecuta; si todo se ve bien, cambia ROLLBACK por COMMIT y ejecuta de nuevo.
-- =============================================================================

-- Opcional: descomenta para ejecutar en transacción y poder hacer ROLLBACK
-- BEGIN;

-- 1. Historial de saldo (referencia a users)
DELETE FROM public.balance_transactions;

-- 2. Notificaciones (referencia a users)
DELETE FROM public.notifications;

-- 3. Claims "acción realizada hacia otro" (referencia a users y action_types)
DELETE FROM public.action_claims;

-- 4. Registros de acciones realizadas (referencia a users y action_types)
DELETE FROM public.action_records;

-- 5. Solicitudes de acciones (referencia a users y action_types)
DELETE FROM public.action_requests;

-- 6. Restaurar saldo inicial de todos los usuarios (como al registrarse)
UPDATE public.users
SET points_balance = 100,
    updated_at   = now();

-- Opcional: descomenta y elige uno
-- ROLLBACK;   -- para deshacer y dejar la BD como estaba
-- COMMIT;     -- para confirmar los cambios
