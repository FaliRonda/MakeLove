-- Corregir usuario huérfano: fila en public.users con id que no coincide con auth.users
-- (p. ej. a7b6bad2-0f5d-... en public vs a7b6bed2-015d-... en auth)
-- Elimina la fila incorrecta para que ensure_my_profile cree la correcta en el próximo login.
DELETE FROM public.users
WHERE email = 'rafael.ronda.garcia@gmail.com'
  AND id NOT IN (SELECT id FROM auth.users WHERE email = 'rafael.ronda.garcia@gmail.com');
