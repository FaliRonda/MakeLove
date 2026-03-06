import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import { usePendingRequestsForUser } from '@/hooks/useRequests'
import { useBalanceHistory } from '@/hooks/useBalanceHistory'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/Avatar'
import { formatDateTime } from '@/lib/utils'

function RankBadge({ position }: { position: number }) {
  if (position === 1) {
    return <span className="text-lg font-bold text-amber-400" title="1º">1º</span>
  }
  if (position === 2) {
    return <span className="text-lg font-bold text-slate-300" title="2º">2º</span>
  }
  return <span className="text-app-muted font-medium tabular-nums">{position}º</span>
}

export function Dashboard() {
  const { profile } = useAuth()
  const { data: users = [] } = useUsers()
  const { data: pendingRequests = [] } = usePendingRequestsForUser(profile?.id)
  const { data: balanceHistory = [] } = useBalanceHistory(profile?.id)

  const ranking = [...users].sort((a, b) => b.points_balance - a.points_balance)

  return (
    <div className="space-y-6">
      <div className="bg-app-surface rounded-2xl p-6 shadow-sm border border-app-border">
        <h2 className="text-lg font-semibold text-app-foreground mb-4">Ranking</h2>
        <div className="space-y-3">
          {ranking.map((user, index) => {
            const position = index + 1
            const isCurrentUser = user.id === profile?.id
            const isTop = position === 1
            const profilePath = isCurrentUser ? '/profile' : `/profile/${user.id}`
            return (
              <div
                key={user.id}
                className={`flex items-center gap-4 py-3 px-4 rounded-2xl ${
                  isCurrentUser ? 'bg-app-accent/15 border border-app-accent/40' : 'bg-app-bg'
                } ${isTop ? 'scale-[1.02]' : ''}`}
              >
                <span className="w-10 shrink-0 flex justify-end">
                  <RankBadge position={position} />
                </span>
                <Link to={profilePath} className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-app-accent">
                  <Avatar
                    avatarUrl={
                      user.avatar_url
                        ? `${user.avatar_url}?t=${user.updated_at || ''}`
                        : null
                    }
                    name={user.name}
                    size={isTop ? 'md' : 'sm'}
                    className={isTop ? 'shadow-lg' : ''}
                  />
                </Link>
                <Link
                  to={profilePath}
                  className={`flex-1 min-w-0 font-medium hover:text-app-accent focus:outline-none focus:ring-2 focus:ring-app-accent rounded ${
                    isCurrentUser ? 'text-app-foreground' : 'text-app-muted'
                  } ${isTop ? 'text-base' : 'text-sm'}`}
                >
                  {user.name}
                  {isCurrentUser && <span className="ml-2 text-xs text-app-accent">(tú)</span>}
                </Link>
                <span className={`shrink-0 font-bold tabular-nums ${position === 1 ? 'text-amber-400' : position === 2 ? 'text-slate-300' : 'text-app-foreground'}`}>
                  {user.points_balance} pts
                </span>
              </div>
            )
          })}
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
