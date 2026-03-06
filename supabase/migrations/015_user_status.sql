-- Campo "Estado" en perfil: texto visible para otros en el perfil
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS estado TEXT;
