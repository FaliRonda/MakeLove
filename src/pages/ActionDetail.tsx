import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getRestHeaders, supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import { useCreateClaim } from '@/hooks/useClaims'
import { Button } from '@/components/ui/Button'

export function ActionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [targetUserId, setTargetUserId] = useState('')

  const { data: users = [] } = useUsers()
  const otherUsers = users.filter((u) => u.id !== profile?.id)

  const { data: action, isLoading, error } = useQuery({
    queryKey: ['action_type', id],
    queryFn: async () => {
      if (!id) return null
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(
          `${h.url}/rest/v1/action_types?id=eq.${encodeURIComponent(id)}&select=*`,
          { headers: { apikey: h.key, Authorization: `Bearer ${h.token}` } }
        )
        if (!res.ok) return null
        const data = await res.json()
        const row = Array.isArray(data) ? data[0] : data
        return row ?? null
      }
      if (!supabase) return null
      const { data, error: err } = await supabase
        .from('action_types')
        .select('*')
        .eq('id', id)
        .single()
      if (err) throw err
      return data
    },
    enabled: !!id,
  })

  const createClaim = useCreateClaim()

  const handleSubmit = async () => {
    if (!id || !targetUserId) return
    try {
      await createClaim.mutateAsync({
        actionTypeId: id,
        targetUserId,
      })
      setShowForm(false)
      setTargetUserId('')
      navigate('/')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    }
  }

  if (isLoading || !action) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-app-foreground">Detalle de la acción</h1>
        <div className="animate-pulse h-32 bg-app-surface-alt rounded-xl" />
      </div>
    )
  }

  if (error || !(action as { is_active?: boolean }).is_active) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">Acción no encontrada o inactiva</p>
        <Button variant="outline" onClick={() => navigate('/actions')}>Volver</Button>
      </div>
    )
  }

  const pointsAward = Math.floor((action.points_value * 150) / 100)

  return (
    <div className="space-y-6">
      <div className="bg-app-surface rounded-2xl p-6 shadow-sm border border-app-border">
        <div className="flex justify-between items-start">
          <h1 className="text-xl font-bold text-app-foreground">{action.name}</h1>
          <Link to={`/actions/${action.id}/history`} className="text-sm text-app-accent hover:underline">
            Ver historial
          </Link>
        </div>
        {action.description && (
          <p className="text-app-muted mt-2">{action.description}</p>
        )}
        <div className="mt-4 flex items-center gap-2">
          <span className="text-2xl font-bold text-app-accent">+{pointsAward} pts</span>
          <span className="text-app-muted">si quien la recibe confirma (1.5×)</span>
        </div>
      </div>

      <div className="bg-app-surface rounded-2xl p-6 shadow-sm border border-app-border">
        <h2 className="font-semibold text-app-foreground mb-3">Acción realizada hacia otro</h2>
        <p className="text-app-muted text-sm mb-4">
          Indica hacia qué usuario has realizado esta acción. Esa persona recibirá una notificación y podrá confirmar o cancelar. Si confirma, tú ganas {pointsAward} pts.
        </p>
        {!showForm ? (
          <Button
            className="w-full"
            size="lg"
            onClick={() => setShowForm(true)}
            disabled={!profile || otherUsers.length === 0}
          >
            Acción realizada
          </Button>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-app-foreground mb-1">Hacia qué usuario</label>
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-app-border-hover bg-app-surface text-app-foreground"
              >
                <option value="">Elige un usuario</option>
                {otherUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false)
                  setTargetUserId('')
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                loading={createClaim.isPending}
                disabled={!targetUserId}
              >
                Enviar
              </Button>
            </div>
          </div>
        )}
        {otherUsers.length === 0 && profile && (
          <p className="text-sm text-app-muted mt-2">No hay otros usuarios para elegir.</p>
        )}
      </div>
    </div>
  )
}
