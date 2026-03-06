-- Imagen de perfil: columna en users y bucket de almacenamiento
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Bucket público para avatares (solo imágenes, máx 2MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas: cualquiera puede ver; solo el dueño puede subir/actualizar/borrar su carpeta
CREATE POLICY "Avatares: lectura pública"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Avatares: subir solo en tu carpeta"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Avatares: actualizar solo tu carpeta"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Avatares: borrar solo tu carpeta"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
