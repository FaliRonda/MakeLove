import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications, useMarkNotificationRead } from '@/hooks/useNotifications'
import { usePendingClaimsForUser, useConfirmClaim, useCancelClaim } from '@/hooks/useClaims'
import { formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

function notificationMessage(type: string): string {
  switch (type) {
    case 'action_request':
      return 'Nueva solicitud de acción'
    case 'performed_for_request':
      return 'Alguien indica que ha realizado una acción hacia ti. ¿Confirmas o cancelas?'
    case 'performed_for_confirmed':
      return 'Alguien ha confirmado que realizaste una acción hacia él/ella. Has ganado 1.5× los puntos.'
    case 'performed_for_cancelled':
      return 'Alguien ha cancelado tu registro de acción realizada hacia él/ella.'
    case 'request_rejected':
      return 'La solicitud fue rechazada. Has ganado 0.2× los puntos (ver historial de saldo).'
    case 'request_expired':
      return 'La solicitud ha caducado. Has ganado 0.2× los puntos (ver historial de saldo).'
    default:
      return type
  }
}

export function Notifications() {
  const { profile } = useAuth()
  const { data: notifications = [], isLoading } = useNotifications(profile?.id)
  const { data: pendingClaims = [] } = usePendingClaimsForUser(profile?.id)
  const pendingClaimIds = useMemo(() => new Set(pendingClaims.map((c) => c.id)), [pendingClaims])
  const markRead = useMarkNotificationRead()
  const confirmClaim = useConfirmClaim()
  const cancelClaim = useCancelClaim()

  const handleMarkRead = (id: string) => {
    markRead.mutate(id)
  }

  const handleConfirmClaim = (claimId: string, notificationId: string) => {
    confirmClaim.mutate(claimId, {
      onSuccess: () => markRead.mutate(notificationId),
    })
  }

  const handleCancelClaim = (claimId: string, notificationId: string) => {
    cancelClaim.mutate(claimId, {
      onSuccess: () => markRead.mutate(notificationId),
    })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-app-foreground">Notificaciones</h1>

      {isLoading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-app-surface-alt rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 rounded-xl border transition-colors ${
                n.read ? 'bg-app-surface border-app-border' : 'bg-app-bg border-app-border-hover'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-app-foreground">
                    {notificationMessage(n.type)}
                    {!n.read && n.type !== 'performed_for_request' && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="ml-2 text-sm text-app-accent hover:underline"
                      >
                        Marcar leída
                      </button>
                    )}
                  </p>
                  <p className="text-sm text-app-muted mt-1">{formatDateTime(n.created_at)}</p>
                </div>
                {n.type === 'performed_for_request' && n.reference_id && pendingClaimIds.has(n.reference_id) && (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleConfirmClaim(n.reference_id!, n.id)}
                      disabled={confirmClaim.isPending || cancelClaim.isPending}
                    >
                      Confirmar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancelClaim(n.reference_id!, n.id)}
                      disabled={confirmClaim.isPending || cancelClaim.isPending}
                    >
                      Cancelar
                    </Button>
                  </div>
                )}
                {n.reference_id && n.type === 'action_request' && (
                  <Link
                    to="/requests"
                    className="text-app-accent text-sm font-medium hover:underline shrink-0"
                  >
                    Ver solicitudes
                  </Link>
                )}
                {n.reference_id && (n.type === 'request_rejected' || n.type === 'request_expired') && (
                  <Link
                    to="/"
                    className="text-app-accent text-sm font-medium hover:underline shrink-0"
                  >
                    Ver historial
                  </Link>
                )}
              </div>
            </div>
          ))}
          {notifications.length === 0 && (
            <p className="text-app-muted text-center py-8">No tienes notificaciones</p>
          )}
        </div>
      )}
    </div>
  )
}
