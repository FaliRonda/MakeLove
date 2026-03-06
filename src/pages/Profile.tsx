import { useRef, useState, useCallback } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { useAuth } from '@/hooks/useAuth'
import { useUpdateUser } from '@/hooks/useUsers'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/Avatar'
import { getCroppedImg } from '@/lib/cropImage'
import { supabase } from '@/lib/supabase'

export function Profile() {
  const { profile, signOut, refetchProfile, user } = useAuth()
  const updateUser = useUpdateUser()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [editorImage, setEditorImage] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [latestAvatarUrl, setLatestAvatarUrl] = useState<string | null>(null)

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setCroppedAreaPixels(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setEditorImage(URL.createObjectURL(file))
    e.target.value = ''
  }

  const closeEditor = useCallback(() => {
    if (editorImage) URL.revokeObjectURL(editorImage)
    setEditorImage(null)
    setCroppedAreaPixels(null)
  }, [editorImage])

  const handleApplyCrop = async () => {
    if (!editorImage || !croppedAreaPixels || !profile?.id || !supabase) return
    setUploadError(null)
    try {
      const blob = await getCroppedImg(editorImage, croppedAreaPixels, true)
      const path = `${profile.id}/avatar.jpg`
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (uploadErr) throw uploadErr
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const newAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`
      await updateUser.mutateAsync({ id: profile.id, avatar_url: urlData.publicUrl })
      setLatestAvatarUrl(newAvatarUrl)
      await refetchProfile()
      closeEditor()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al subir la imagen')
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-app-surface rounded-2xl p-6 shadow-sm border border-app-border">
        <h2 className="text-lg font-semibold text-app-foreground">Mi perfil</h2>
        <div className="mt-4 flex flex-col sm:flex-row items-start gap-6">
          <div className="flex flex-col items-center gap-2">
            <Avatar
              avatarUrl={
                latestAvatarUrl ||
                (profile?.avatar_url
                  ? `${profile.avatar_url}?t=${profile.updated_at || ''}`
                  : null)
              }
              name={profile?.name ?? 'Usuario'}
              size="lg"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={updateUser.isPending}
            >
              {updateUser.isPending ? 'Subiendo…' : 'Cambiar imagen'}
            </Button>
            {uploadError && (
              <p className="text-red-600 text-xs text-center max-w-[200px]">{uploadError}</p>
            )}
          </div>
          <dl className="flex-1 space-y-3">
            <div>
              <dt className="text-sm text-app-muted">Nombre</dt>
              <dd className="font-medium text-app-foreground-dark">{profile?.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-app-muted">Email</dt>
              <dd className="font-medium text-app-foreground-dark">{profile?.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-app-muted">Saldo</dt>
              <dd className="font-bold text-app-muted text-xl">{profile?.points_balance} puntos</dd>
            </div>
            {profile?.created_at && (
              <div>
                <dt className="text-sm text-app-muted">Miembro desde</dt>
                <dd className="font-medium text-app-foreground-dark">{formatDate(profile.created_at)}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="mt-6 pt-6 border-t border-app-border flex flex-wrap gap-2">
          {!profile && user && (
            <Button variant="secondary" size="sm" onClick={() => refetchProfile()}>
              Reintentar cargar perfil
            </Button>
          )}
          <Button variant="outline" onClick={() => signOut()} className="w-full sm:w-auto">
            Cerrar sesión
          </Button>
        </div>
      </div>

      {editorImage && (
        <div className="fixed inset-0 z-50 flex flex-col bg-app-bg">
          <div className="flex-1 min-h-0 relative">
            <Cropper
              image={editorImage}
              crop={crop}
              zoom={zoom}
              cropShape="round"
              showGrid={false}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              style={{ containerStyle: { backgroundColor: 'var(--app-bg)' } }}
            />
          </div>
          <div className="p-4 pb-safe border-t border-app-border bg-app-surface flex flex-col gap-3">
            <label className="text-sm text-app-muted font-medium">
              Zoom
            </label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none bg-app-bg accent-app-accent"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={closeEditor}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleApplyCrop}
                disabled={!croppedAreaPixels || updateUser.isPending}
              >
                {updateUser.isPending ? 'Subiendo…' : 'Aplicar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
