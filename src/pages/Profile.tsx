import { useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import Cropper, { type Area } from 'react-easy-crop'
import { useAuth } from '@/hooks/useAuth'
import { useUser, useUpdateUser } from '@/hooks/useUsers'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useActionRecords } from '@/hooks/useActionRecords'
import { useActionRequests } from '@/hooks/useRequests'
import { formatDate, formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/Avatar'
import { getCroppedImg } from '@/lib/cropImage'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types'
import type { ActionRecordWithDetails } from '@/types'
import type { ActionRequest } from '@/types'

const PAGE_SIZE = 5

type HistoryItem =
  | { kind: 'record'; date: string; id: string; record: ActionRecordWithDetails }
  | { kind: 'request'; date: string; id: string; request: ActionRequest & { action_types?: { name: string }; requester?: { name: string }; target?: { name: string } } }

function buildHistoryItems(
  records: ActionRecordWithDetails[],
  requests: (ActionRequest & { action_types?: { name: string }; requester?: { name: string }; target?: { name: string } })[]
): HistoryItem[] {
  const items: HistoryItem[] = []
  for (const r of records) {
    items.push({ kind: 'record', date: r.performed_at, id: `r-${r.id}`, record: r })
  }
  for (const req of requests) {
    if (req.status === 'pending') continue
    const date = req.responded_at ?? req.created_at
    items.push({ kind: 'request', date, id: `q-${req.id}`, request: req })
  }
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return items
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function Profile() {
  const { userId: paramUserId } = useParams()
  const { profile, signOut, refetchProfile, user } = useAuth()
  const { data: viewedUser } = useUser(paramUserId ?? undefined)
  const updateUser = useUpdateUser()
  const { status: pushStatus, isRegistering, registerPush } = usePushNotifications(profile?.id)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [editorImage, setEditorImage] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [latestAvatarUrl, setLatestAvatarUrl] = useState<string | null>(null)
  const [photoLightbox, setPhotoLightbox] = useState(false)
  const [historyLimit, setHistoryLimit] = useState(PAGE_SIZE)

  const isOwnProfile = !paramUserId || paramUserId === profile?.id
  const displayUser: User | null = isOwnProfile ? (profile ?? null) : (viewedUser ?? null)

  const { data: actionRecords = [] } = useActionRecords({
    userId: displayUser?.id,
    enabled: !!displayUser?.id,
  })
  const { data: allRequests = [] } = useActionRequests()
  const involvedRequests = displayUser?.id
    ? allRequests.filter(
        (r) =>
          (r.requester_id === displayUser.id || r.target_user_id === displayUser.id) &&
          r.status !== 'pending'
      )
    : []
  const historyItems = displayUser?.id
    ? buildHistoryItems(actionRecords as ActionRecordWithDetails[], involvedRequests)
    : []
  const visibleHistory = historyItems.slice(0, historyLimit)
  const hasMoreHistory = historyItems.length > historyLimit

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

  const avatarUrl =
    latestAvatarUrl ||
    (displayUser?.avatar_url
      ? `${displayUser.avatar_url}?t=${displayUser.updated_at || ''}`
      : null)

  if (paramUserId && !displayUser && viewedUser === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-app-muted">Cargando perfil...</p>
      </div>
    )
  }
  if (paramUserId && !displayUser) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-app-muted">Usuario no encontrado</p>
      </div>
    )
  }
  if (!displayUser) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-app-muted">Inicia sesión para ver tu perfil</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-app-surface rounded-2xl p-6 shadow-sm border border-app-border">
        <h2 className="text-lg font-semibold text-app-foreground mb-4">
          {isOwnProfile ? 'Mi perfil' : 'Perfil'}
        </h2>

        {/* Foto grande centrada; click abre lightbox */}
        <div className="flex flex-col items-center mb-6">
          <button
            type="button"
            onClick={() => setPhotoLightbox(true)}
            className="focus:outline-none focus:ring-2 focus:ring-app-accent rounded-full"
            aria-label="Ver foto en grande"
          >
            <Avatar
              avatarUrl={avatarUrl}
              name={displayUser.name}
              size="xl"
              className="shrink-0"
            />
          </button>
          {isOwnProfile && (
            <>
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
                className="mt-3"
                onClick={() => fileInputRef.current?.click()}
                disabled={updateUser.isPending}
              >
                {updateUser.isPending ? 'Subiendo…' : 'Cambiar imagen'}
              </Button>
              {uploadError && (
                <p className="text-red-600 text-xs text-center mt-1 max-w-[200px]">{uploadError}</p>
              )}
            </>
          )}
        </div>

        <dl className="space-y-3">
          <div>
            <dt className="text-sm text-app-muted">Nombre</dt>
            <dd className="font-medium text-app-foreground-dark">{displayUser.name}</dd>
          </div>
          {isOwnProfile && (
            <div>
              <dt className="text-sm text-app-muted">Email</dt>
              <dd className="font-medium text-app-foreground-dark">{displayUser.email}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-app-muted">Saldo</dt>
            <dd className="font-bold text-app-muted text-xl">{displayUser.points_balance} puntos</dd>
          </div>
          {displayUser.created_at && (
            <div>
              <dt className="text-sm text-app-muted">{isOwnProfile ? 'Miembro desde' : 'Miembro desde'}</dt>
              <dd className="font-medium text-app-foreground-dark">{formatDate(displayUser.created_at)}</dd>
            </div>
          )}
        </dl>

        {/* Histórico: acciones y solicitudes (encima de push) */}
        <div className="mt-6 pt-6 border-t border-app-border">
          <h3 className="text-sm font-medium text-app-foreground mb-2">Historial de acciones y solicitudes</h3>
          {visibleHistory.length === 0 ? (
            <p className="text-sm text-app-muted">Aún no hay acciones ni solicitudes</p>
          ) : (
            <>
              <ul className="space-y-2">
                {visibleHistory.map((item) => {
                  if (item.kind === 'record') {
                    const at = item.record.action_types
                    return (
                      <li
                        key={item.id}
                        className="text-sm p-3 rounded-lg bg-app-bg border border-app-border"
                      >
                        <span className="text-app-muted">{formatDateTime(item.date)}</span>
                        <span className="text-app-foreground ml-2">
                          Realizó {at?.name ?? 'acción'}
                          {item.record.notes && (
                            <span className="text-app-muted"> — {item.record.notes}</span>
                          )}
                        </span>
                      </li>
                    )
                  }
                  const req = item.request
                  const actionName = req.action_types?.name ?? 'acción'
                  const statusLabel =
                    req.status === 'accepted'
                      ? 'Aceptada'
                      : req.status === 'rejected'
                        ? 'Rechazada'
                        : req.status === 'expired'
                          ? 'Caducada'
                          : req.status === 'cancelled'
                            ? 'Cancelada'
                            : req.status
                  return (
                    <li
                      key={item.id}
                      className="text-sm p-3 rounded-lg bg-app-bg border border-app-border"
                    >
                      <span className="text-app-muted">{formatDateTime(item.date)}</span>
                      <span className="text-app-foreground ml-2">
                        Solicitud {actionName} — {statusLabel}
                        {req.requester?.name && req.target?.name && (
                          <span className="text-app-muted">
                            {' '}
                            ({req.requester.name} → {req.target.name})
                          </span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
              {hasMoreHistory && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setHistoryLimit((n) => n + PAGE_SIZE)}
                >
                  Mostrar más
                </Button>
              )}
            </>
          )}
        </div>

        {isOwnProfile && (
          <>
            <div className="mt-6 pt-6 border-t border-app-border">
              <h3 className="text-sm font-medium text-app-foreground mb-2">Notificaciones push</h3>
              <p className="text-sm text-app-muted mb-2">
                {pushStatus === 'subscribed' && 'Recibirás notificaciones cuando alguien te envíe una solicitud o tengas novedades.'}
                {pushStatus === 'idle' && 'Activa las notificaciones para recibir avisos en el móvil o el navegador.'}
                {pushStatus === 'permission-denied' && 'Has bloqueado las notificaciones. Actívalas en la configuración del navegador o del móvil para recibir avisos.'}
                {pushStatus === 'error' && 'No se pudo activar. Comprueba que el navegador permita notificaciones e inténtalo de nuevo.'}
                {pushStatus === 'vapid-missing' && 'Las notificaciones push no están configuradas en este despliegue. El equipo debe añadir la variable VITE_VAPID_PUBLIC_KEY en Netlify (o en el servidor donde se despliega) y volver a desplegar.'}
                {pushStatus === 'unsupported' && 'Tu navegador o esta app no soportan notificaciones push (por ejemplo en HTTP o en modo incógnito).'}
              </p>
              {(pushStatus === 'idle' || pushStatus === 'permission-denied' || pushStatus === 'error') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => registerPush()}
                  disabled={isRegistering}
                >
                  {isRegistering ? 'Activando…' : 'Activar notificaciones'}
                </Button>
              )}
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
          </>
        )}
      </div>

      {/* Lightbox foto (estilo WhatsApp) */}
      {photoLightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setPhotoLightbox(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setPhotoLightbox(false)}
          aria-label="Cerrar"
        >
          <button
            type="button"
            onClick={() => setPhotoLightbox(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
            aria-label="Cerrar"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayUser.name}
              className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-full"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              className="w-48 h-48 rounded-full bg-app-bg border border-app-border flex items-center justify-center text-5xl font-bold text-app-muted"
              onClick={(e) => e.stopPropagation()}
            >
              {getInitials(displayUser.name)}
            </div>
          )}
        </div>
      )}

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
            <label className="text-sm text-app-muted font-medium">Zoom</label>
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
