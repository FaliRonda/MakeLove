import { useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useUpdateUser } from '@/hooks/useUsers'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/Avatar'
import { supabase } from '@/lib/supabase'

export function Profile() {
  const { profile, signOut, refetchProfile, user } = useAuth()
  const updateUser = useUpdateUser()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile?.id || !supabase) return
    setUploadError(null)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${profile.id}/avatar.${ext}`
    try {
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      await updateUser.mutateAsync({ id: profile.id, avatar_url: urlData.publicUrl })
      await refetchProfile()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al subir la imagen')
    }
    e.target.value = ''
  }

  return (
    <div className="space-y-6">
      <div className="bg-app-surface rounded-2xl p-6 shadow-sm border border-app-border">
        <h2 className="text-lg font-semibold text-app-foreground">Mi perfil</h2>
        <div className="mt-4 flex flex-col sm:flex-row items-start gap-6">
          <div className="flex flex-col items-center gap-2">
            <Avatar
              avatarUrl={profile?.avatar_url ?? null}
              name={profile?.name ?? 'Usuario'}
              size="lg"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
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
    </div>
  )
}
