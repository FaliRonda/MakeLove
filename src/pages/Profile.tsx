import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import Cropper, { type Area } from 'react-easy-crop'
import { useAuth } from '@/hooks/useAuth'
import { useUser, useUpdateUser } from '@/hooks/useUsers'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useBalanceHistory } from '@/hooks/useBalanceHistory'
import { useActionRecords } from '@/hooks/useActionRecords'
import { useActionRequests } from '@/hooks/useRequests'
import { experienceByTransactionId } from '@/lib/experienceHistory'
import { formatDate, formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { Avatar } from '@/components/Avatar'
import { LevelAndMedalsSection } from '@/components/profile/LevelAndMedalsSection'
import { getCroppedImg } from '@/lib/cropImage'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types'
import type { ActionRecordWithDetails } from '@/types'
import type { ActionRequest } from '@/types'
import type { BalanceTransaction } from '@/types'

const PAGE_SIZE = 5

type HistoryItem =
  | { kind: 'record'; date: string; id: string; record: ActionRecordWithDetails }
  | { kind: 'request'; date: string; id: string; request: ActionRequest & { action_types?: { name: string }; requester?: { name: string }; target?: { name: string } } }
  | { kind: 'balance'; date: string; id: string; tx: BalanceTransaction }

function buildHistoryItems(
  records: ActionRecordWithDetails[],
  requests: (ActionRequest & { action_types?: { name: string }; requester?: { name: string }; target?: { name: string } })[]
): HistoryItem[] {
  const items: HistoryItem[] = []
  for (const r of records) {
    // Evita duplicar con “Solicitud … Aceptada” cuando la acción viene de una solicitud aceptada.
    if (r.request_id) continue
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

/** Movimientos de saldo sin acción/solicitud vinculada (p. ej. recompensa semanal). */
function orphanBalanceHistoryItems(txs: BalanceTransaction[]): HistoryItem[] {
  return txs
    .filter((t) => t.reference_id == null)
    .map((t) => ({
      kind: 'balance' as const,
      date: t.created_at,
      id: `b-${t.id}`,
      tx: t,
    }))
}

function mergeAndSortHistory(base: HistoryItem[], extra: HistoryItem[]): HistoryItem[] {
  return [...base, ...extra].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
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
  const { status: pushStatus, isRegistering, registerPush, unregisterPush } = usePushNotifications(profile?.id)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [editorImage, setEditorImage] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [latestAvatarUrl, setLatestAvatarUrl] = useState<string | null>(null)
  const [photoLightbox, setPhotoLightbox] = useState(false)
  const [historyLimit, setHistoryLimit] = useState(PAGE_SIZE)
  const [statusInput, setStatusInput] = useState('')

  const isOwnProfile = !paramUserId || paramUserId === profile?.id
  const displayUser: User | null = isOwnProfile ? (profile ?? null) : (viewedUser ?? null)
  const { data: balanceTransactions = [] } = useBalanceHistory(displayUser?.id)

  // balance_transactions.reference_id apunta a distintas "fuentes" (request id, claim id, etc).
  // Este mapa permite encontrar rápidamente la variación de puntos asociada a lo que mostramos en el historial.
  const balanceByReferenceId = useMemo(() => {
    const m = new Map<string, BalanceTransaction[]>()
    for (const t of balanceTransactions) {
      if (!t.reference_id) continue
      const key = String(t.reference_id)
      const prev = m.get(key)
      if (prev) prev.push(t)
      else m.set(key, [t])
    }
    return m
  }, [balanceTransactions])

  const experienceByTxId = useMemo(() => {
    if (!displayUser?.id) return new Map<string, number>()
    return experienceByTransactionId(
      balanceTransactions,
      displayUser.lifetime_points_earned ?? 100
    )
  }, [balanceTransactions, displayUser?.id, displayUser?.lifetime_points_earned])

  useEffect(() => {
    if (isOwnProfile && displayUser) setStatusInput(displayUser.estado ?? '')
  }, [isOwnProfile, displayUser?.id, displayUser?.estado])

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
  const historyItems = useMemo(() => {
    if (!displayUser?.id) return []
    const base = buildHistoryItems(
      actionRecords as ActionRecordWithDetails[],
      involvedRequests
    )
    const orphans = orphanBalanceHistoryItems(balanceTransactions)
    return mergeAndSortHistory(base, orphans)
  }, [displayUser?.id, actionRecords, involvedRequests, balanceTransactions])
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
          <div>
            <dt className="text-sm text-app-muted">Estado</dt>
            {isOwnProfile ? (
              <dd className="mt-1">
                <input
                  type="text"
                  value={statusInput}
                  onChange={(e) => setStatusInput(e.target.value)}
                  placeholder="Escribe tu estado..."
                  className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-app-foreground placeholder:text-app-muted focus:border-app-accent focus:outline-none focus:ring-1 focus:ring-app-accent"
                  maxLength={200}
                  aria-label="Estado de perfil"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={async () => {
                    if (profile?.id == null) return
                    await updateUser.mutateAsync({ id: profile.id, estado: statusInput || null })
                    refetchProfile()
                  }}
                  disabled={updateUser.isPending}
                >
                  {updateUser.isPending ? 'Guardando…' : 'Guardar estado'}
                </Button>
              </dd>
            ) : (
              <dd className="font-medium text-app-foreground-dark">
                {displayUser.estado?.trim() ? displayUser.estado : '—'}
              </dd>
            )}
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

        <LevelAndMedalsSection
          userId={displayUser.id}
          lifetimePoints={displayUser.lifetime_points_earned ?? 100}
          isOwnProfile={isOwnProfile}
        />

        {/* Histórico: acciones y solicitudes (encima de push) */}
        <div className="mt-6 pt-6 border-t border-app-border">
          <h3 className="text-sm font-medium text-app-foreground mb-2">
            Historial de acciones, solicitudes y recompensas
          </h3>
          {visibleHistory.length === 0 ? (
            <p className="text-sm text-app-muted">Aún no hay actividad reciente</p>
          ) : (
            <>
              <ul className="space-y-2">
                {visibleHistory.map((item) => {
                  if (item.kind === 'balance') {
                    const tx = item.tx
                    const title =
                      tx.event_type === 'weekly_collab_reward'
                        ? 'Recompensa objetivo semanal colaborativo'
                        : tx.description?.trim() || tx.event_type
                    return (
                      <li
                        key={item.id}
                        className="text-sm p-3 rounded-lg bg-app-bg border border-app-border"
                      >
                        <span className="text-app-muted">{formatDateTime(item.date)}</span>
                        <span className="text-app-foreground ml-2">
                          {title}
                          <span
                            className={
                              tx.delta >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'
                            }
                          >
                            {' '}
                            {tx.delta >= 0 ? '+' : ''}
                            {tx.delta} pts
                          </span>
                          <span className="text-app-muted ml-2 tabular-nums">
                            Saldo: {tx.balance_after} pts
                            <span className="text-app-muted/80 mx-1">·</span>
                            Experiencia: {experienceByTxId.get(tx.id) ?? '—'}
                          </span>
                        </span>
                      </li>
                    )
                  }
                  if (item.kind === 'record') {
                    const at = item.record.action_types
                    const isDoer = displayUser?.id && item.record.user_id === displayUser.id
                    const otherName = isDoer ? item.record.target_user?.name : item.record.users?.name
                    const balanceRefId = item.record.record_claim_id ?? item.record.request_id ?? null
                    const bt = balanceRefId ? balanceByReferenceId.get(balanceRefId)?.[0] : undefined
                    return (
                      <li
                        key={item.id}
                        className="text-sm p-3 rounded-lg bg-app-bg border border-app-border"
                      >
                        <span className="text-app-muted">{formatDateTime(item.date)}</span>
                        <span className="text-app-foreground ml-2">
                          {isDoer ? (
                            <>Realizó {at?.name ?? 'acción'} hacia {otherName ?? 'alguien'}</>
                          ) : (
                            <>Recibió {at?.name ?? 'acción'} de {otherName ?? 'alguien'}</>
                          )}
                          {bt && (
                            <>
                              <span className={bt.delta >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                                {' '}
                                {bt.delta >= 0 ? '+' : ''}{bt.delta} pts
                              </span>
                              <span className="text-app-muted ml-2 tabular-nums">
                                Saldo: {bt.balance_after} pts
                                <span className="text-app-muted/80 mx-1">·</span>
                                Experiencia: {experienceByTxId.get(bt.id) ?? '—'}
                              </span>
                            </>
                          )}
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
                  const bt = balanceByReferenceId.get(req.id)?.[0]
                  return (
                    <li
                      key={item.id}
                      className="text-sm p-3 rounded-lg bg-app-bg border border-app-border"
                    >
                      <span className="text-app-muted">{formatDateTime(item.date)}</span>
                      <span className="text-app-foreground ml-2">
                        Solicitud {actionName} — {statusLabel}
                        {bt && (
                          <>
                            <span className={bt.delta >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                              {' '}
                              {bt.delta >= 0 ? '+' : ''}{bt.delta} pts
                            </span>
                            <span className="text-app-muted ml-2 tabular-nums">
                              Saldo: {bt.balance_after} pts
                              <span className="text-app-muted/80 mx-1">·</span>
                              Experiencia: {experienceByTxId.get(bt.id) ?? '—'}
                            </span>
                          </>
                        )}
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
              <div className="mb-2 space-y-2">
                <h3 className="text-sm font-medium text-app-foreground">Notificaciones push</h3>
                <div className="flex flex-col items-start gap-1">
                  <Switch
                    checked={pushStatus === 'subscribed'}
                    disabled={
                      isRegistering ||
                      pushStatus === 'unsupported' ||
                      pushStatus === 'vapid-missing' ||
                      pushStatus === 'permission-denied'
                    }
                    aria-label={
                      pushStatus === 'subscribed'
                        ? 'Notificaciones push activadas'
                        : 'Notificaciones push desactivadas'
                    }
                    onCheckedChange={(on) => {
                      if (on) void registerPush()
                      else void unregisterPush()
                    }}
                  />
                  <span className="text-xs font-medium text-app-muted tabular-nums">
                    {pushStatus === 'subscribed' ? 'Activadas' : 'Desactivadas'}
                  </span>
                </div>
              </div>
              <p className="text-sm text-app-muted">
                {pushStatus === 'subscribed' && 'Recibirás notificaciones cuando alguien te envíe una solicitud o tengas novedades.'}
                {pushStatus === 'idle' && 'Activa el interruptor para recibir avisos en el móvil o el navegador.'}
                {pushStatus === 'permission-denied' && 'Has bloqueado las notificaciones. Actívalas en la configuración del navegador o del móvil para poder usar el interruptor.'}
                {pushStatus === 'error' && 'No se pudo cambiar el estado. Comprueba que el navegador permita notificaciones e inténtalo de nuevo.'}
                {pushStatus === 'vapid-missing' && 'Las notificaciones push no están configuradas en este despliegue. El equipo debe añadir la variable VITE_VAPID_PUBLIC_KEY en Netlify (o en el servidor donde se despliega) y volver a desplegar.'}
                {pushStatus === 'unsupported' && 'Tu navegador o esta app no soportan notificaciones push (por ejemplo en HTTP o en modo incógnito).'}
              </p>
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
