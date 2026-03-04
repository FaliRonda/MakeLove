import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { usePendingRequestsForUser } from '@/hooks/useRequests'
import { useBalanceHistory } from '@/hooks/useBalanceHistory'
import { Button } from '@/components/ui/Button'
import { formatDateTime } from '@/lib/utils'

export function Dashboard() {
  const { profile } = useAuth()
  const { data: pendingRequests = [] } = usePendingRequestsForUser(profile?.id)
  const { data: balanceHistory = [] } = useBalanceHistory(profile?.id)

  return (
    <div className="space-y-6">
      <div className="bg-app-surface rounded-2xl p-6 shadow-sm border border-app-border">
        <h2 className="text-lg font-semibold text-app-foreground">¡Hola, {profile?.name ?? 'Usuario'}!</h2>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-app-muted">{profile?.points_balance ?? 0}</span>
          <span className="text-app-muted">puntos</span>
        </div>
      </div>

      {pendingRequests.length > 0 && (
        <div className="bg-app-bg border border-app-border-hover rounded-2xl p-4">
          <h3 className="font-semibold text-app-foreground mb-2">
            Tienes {pendingRequests.length} solicitud{pendingRequests.length > 1 ? 'es' : ''} pendiente{pendingRequests.length > 1 ? 's' : ''}
          </h3>
          <Link to="/requests">
            <Button size="sm">Ver solicitudes</Button>
          </Link>
        </div>
      )}

      <div>
        <h3 className="font-semibold text-app-foreground mb-3">Historial de saldo</h3>
        <p className="text-sm text-app-muted mb-3">Últimos movimientos (más reciente primero)</p>
        {balanceHistory.length === 0 ? (
          <p className="text-app-muted text-center py-6 bg-app-surface rounded-xl border border-app-border">Aún no hay movimientos</p>
        ) : (
          <div className="space-y-2">
            {balanceHistory.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 bg-app-surface rounded-xl border border-app-border text-sm"
              >
                <span className="text-app-accent shrink-0">{formatDateTime(t.created_at)}</span>
                <span className="text-app-foreground flex-1 min-w-0">{t.description ?? t.event_type}</span>
                <span className={t.delta >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                  {t.delta >= 0 ? '+' : ''}{t.delta} pts
                </span>
                <span className="text-app-muted">Saldo: {t.balance_after} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
