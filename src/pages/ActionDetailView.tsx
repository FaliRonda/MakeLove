import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase, getRestHeaders } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useActionRecords } from '@/hooks/useActionRecords'
import { useUsers } from '@/hooks/useUsers'
import { formatDate } from '@/lib/utils'

export function ActionDetailView() {
  const { id } = useParams<{ id: string }>()
  const { profile, isAdmin } = useAuth()
  const [userId, setUserId] = useState<string | undefined>(profile?.id)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const { data: users = [] } = useUsers()
  const { data: action } = useQuery({
    queryKey: ['action_type', id],
    queryFn: async () => {
      const h = getRestHeaders()
      if (h && id) {
        const res = await fetch(
          `${h.url}/rest/v1/action_types?id=eq.${encodeURIComponent(id)}&select=*`,
          { headers: { apikey: h.key, Authorization: `Bearer ${h.token}` } }
        )
        if (!res.ok) return null
        const data = await res.json()
        const row = Array.isArray(data) ? data[0] : data
        return row ?? null
      }
      if (!supabase || !id) return null
      const { data, error } = await supabase.from('action_types').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const [y, m] = month.split('-').map(Number)
  const from = new Date(y, m - 1, 1)
  const to = new Date(y, m, 0, 23, 59, 59)

  const { data: records = [] } = useActionRecords({
    actionTypeId: id,
    userId: isAdmin ? userId : profile?.id,
    from,
    to,
  })

  if (!action) return null

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-app-foreground">{action.name}</h1>
      <p className="text-app-muted">{action.description}</p>
      <div className="text-app-accent font-semibold">+{action.points_value} pts por realización</div>

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
      </div>

      <div>
        <h2 className="font-semibold text-app-foreground mb-2">
          Realizaciones ({records.length})
        </h2>
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="p-4 bg-app-surface rounded-xl border border-app-border">
              <div className="flex justify-between">
                <span>{r.users?.name ?? 'Usuario'}</span>
                <span className="text-app-accent">{formatDate(r.performed_at)}</span>
              </div>
              {r.notes && <p className="text-sm text-app-muted mt-1">{r.notes}</p>}
            </div>
          ))}
          {records.length === 0 && (
            <p className="text-app-muted text-center py-8">No hay realizaciones en este período</p>
          )}
        </div>
      </div>
    </div>
  )
}
