import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useActionRecords } from '@/hooks/useActionRecords'
import { useActionTypes } from '@/hooks/useActions'
import { useUsers } from '@/hooks/useUsers'
import { formatDate } from '@/lib/utils'

export function Calendar() {
  const { profile, isAdmin } = useAuth()
  const [userId, setUserId] = useState<string | undefined>(profile?.id)
  const [actionTypeId, setActionTypeId] = useState<string>('')
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const { data: users = [] } = useUsers()
  const { data: actionTypes = [] } = useActionTypes()

  const [y, m] = month.split('-').map(Number)
  const from = new Date(y, m - 1, 1)
  const to = new Date(y, m, 0, 23, 59, 59)

  const { data: records = [], isLoading } = useActionRecords({
    userId: isAdmin ? userId : profile?.id,
    actionTypeId: actionTypeId || undefined,
    from,
    to,
  })

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-app-foreground">Calendario</h1>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-app-foreground mb-1">Mes</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-app-border-hover bg-app-surface"
          />
        </div>
        {isAdmin && (
          <div>
            <label className="block text-sm font-medium text-app-foreground mb-1">Usuario</label>
            <select
              value={userId ?? ''}
              onChange={(e) => setUserId(e.target.value || undefined)}
              className="w-full px-4 py-2 rounded-lg border border-app-border-hover bg-app-surface"
            >
              <option value="">Todos</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-app-foreground mb-1">Tipo de acción</label>
          <select
            value={actionTypeId}
            onChange={(e) => setActionTypeId(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-app-border-hover bg-app-surface"
          >
            <option value="">Todas</option>
            {actionTypes.map((at) => (
              <option key={at.id} value={at.id}>{at.name}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-app-surface-alt rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((r: { id: string; performed_at: string; action_types?: { name: string }; users?: { name: string } }) => (
            <Link
              key={r.id}
              to={`/actions/${(r as { action_type_id: string }).action_type_id}`}
              className="block p-4 bg-app-surface rounded-xl border border-app-border hover:border-app-border-hover"
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium text-app-foreground">
                    {r.action_types?.name ?? 'Acción'}
                  </span>
                  {r.users && (
                    <span className="text-app-muted text-sm ml-2">— {r.users.name}</span>
                  )}
                </div>
                <span className="text-app-accent text-sm">{formatDate(r.performed_at)}</span>
              </div>
            </Link>
          ))}
          {records.length === 0 && (
            <p className="text-app-muted text-center py-8">No hay registros en este período</p>
          )}
        </div>
      )}
    </div>
  )
}
