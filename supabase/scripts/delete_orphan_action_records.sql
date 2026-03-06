-- Elimina action_records "huérfanos": creados por una solicitud aceptada (notas
-- "Solicitud aceptada de X") que luego se revirtió, por lo que no tienen
-- request_id y ya no existe la fila en action_requests.
-- Solo toca registros legacy (request_id IS NULL) para los que no existe
-- ninguna solicitud aceptada que los justifique (mismo usuario, acción,
-- nombre del requester y ventana de tiempo).
-- Ejecutar una sola vez en el SQL Editor de Supabase.
--
-- Opcional: ejecutar primero el SELECT para ver cuántos se borrarían:
--
-- SELECT ar.id, ar.user_id, ar.action_type_id, ar.performed_at, ar.notes
-- FROM public.action_records ar
-- WHERE ar.request_id IS NULL
--   AND ar.notes LIKE 'Solicitud aceptada de %'
--   AND NOT EXISTS (
--     SELECT 1
--     FROM public.action_requests r
--     JOIN public.users u ON u.id = r.requester_id
--     WHERE r.target_user_id = ar.user_id
--       AND r.action_type_id = ar.action_type_id
--       AND r.status = 'accepted'
--       AND ar.notes = 'Solicitud aceptada de ' || u.name
--       AND ar.performed_at >= r.responded_at - interval '2 minutes'
--       AND ar.performed_at <= r.responded_at + interval '2 minutes'
--   );

DELETE FROM public.action_records ar
WHERE ar.request_id IS NULL
  AND ar.notes LIKE 'Solicitud aceptada de %'
  AND NOT EXISTS (
    SELECT 1
    FROM public.action_requests r
    JOIN public.users u ON u.id = r.requester_id
    WHERE r.target_user_id = ar.user_id
      AND r.action_type_id = ar.action_type_id
      AND r.status = 'accepted'
      AND ar.notes = 'Solicitud aceptada de ' || u.name
      AND ar.performed_at >= r.responded_at - interval '2 minutes'
      AND ar.performed_at <= r.responded_at + interval '2 minutes'
  );
