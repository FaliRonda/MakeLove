import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications, useMarkNotificationRead } from '@/hooks/useNotifications'
import {
  useNotificationEnrichment,
  type ClaimEnrichment,
  type RequestEnrichment,
} from '@/hooks/useNotificationEnrichment'
import { usePendingClaimsForUser, useConfirmClaim, useCancelClaim } from '@/hooks/useClaims'
import { notificationBody } from '@/lib/notificationMessages'
import { formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

function notificationMessage(
  type: string,
  referenceId: string | null,
  claimMap: Record<string, ClaimEnrichment>,
  requestMap: Record<string, RequestEnrichment>
): string {
  const request = referenceId ? requestMap[referenceId] : undefined
  const claim = referenceId ? claimMap[referenceId] : undefined
  return notificationBody(type, request, claim)
}

export function Notifications() {
  const { profile } = useAuth()
  const { data: notifications = [], isLoading } = useNotifications(profile?.id)
  const { claimMap, requestMap } = useNotificationEnrichment(notifications)
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
                    {notificationMessage(n.type, n.reference_id, claimMap, requestMap)}
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
                {n.reference_id &&
                  ['action_request', 'request_accepted_pending', 'request_confirmed_target'].includes(n.type) && (
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
