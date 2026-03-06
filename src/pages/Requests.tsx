import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useActionRequests, usePendingRequestsForUser, useAcceptRequest, useRejectRequest, useCreateRequest, useCancelRequest, useRevertRequest } from '@/hooks/useRequests'
import { useActiveActionTypes } from '@/hooks/useActions'
import { useUsers } from '@/hooks/useUsers'
import { Button } from '@/components/ui/Button'
import { formatDateTime } from '@/lib/utils'

export function Requests() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<'pending' | 'resolved'>('pending')
  const [showCreate, setShowCreate] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [targetUserId, setTargetUserId] = useState('')
  const [actionTypeId, setActionTypeId] = useState('')
  const [revertRequestId, setRevertRequestId] = useState<string | null>(null)

  const { data: actionTypes = [] } = useActiveActionTypes()
  const { data: users = [] } = useUsers()
  const { data: pendingRequests = [] } = usePendingRequestsForUser(profile?.id)
  const { data: allRequests = [] } = useActionRequests()

  const acceptRequest = useAcceptRequest()
  const rejectRequest = useRejectRequest()
  const cancelRequest = useCancelRequest()
  const revertRequest = useRevertRequest()
  const createRequest = useCreateRequest()

  const resolvedRequests = allRequests
    .filter((r) => (r.target_user_id === profile?.id || r.requester_id === profile?.id) && r.status !== 'pending')
    .sort((a, b) => new Date(b.responded_at ?? b.created_at).getTime() - new Date(a.responded_at ?? a.created_at).getTime())
  const requestsToShow = tab === 'pending' ? pendingRequests : resolvedRequests

  const handleAccept = async (id: string) => {
    try {
      await acceptRequest.mutateAsync(id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    }
  }

  const handleReject = async (id: string) => {
    try {
      await rejectRequest.mutateAsync(id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await cancelRequest.mutateAsync(id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    }
  }

  const handleRevertConfirm = async () => {
    if (!revertRequestId) return
    try {
      await revertRequest.mutateAsync(revertRequestId)
      setRevertRequestId(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    }
  }

  const handleCreate = async () => {
    if (!targetUserId || !actionTypeId) return
    setCreateError(null)
    try {
      await createRequest.mutateAsync({ targetUserId, actionTypeId })
      setShowCreate(false)
      setTargetUserId('')
      setActionTypeId('')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error al crear la solicitud')
    }
  }

  const otherUsers = users.filter((u) => u.id !== profile?.id)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-app-foreground">Solicitudes</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>Nueva solicitud</Button>
      </div>

      {showCreate && (
        <div className="bg-app-surface rounded-2xl p-6 border border-app-border">
          <h2 className="font-semibold text-app-foreground mb-3">Solicitar acción a otro usuario</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-app-foreground mb-1">Usuario</label>
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-app-border-hover bg-app-surface"
              >
                <option value="">Selecciona...</option>
                {otherUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-foreground mb-1">Acción</label>
              <select
                value={actionTypeId}
                onChange={(e) => setActionTypeId(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-app-border-hover bg-app-surface"
              >
                <option value="">Selecciona...</option>
                {actionTypes.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} (coste: {a.points_value} pts)</option>
                ))}
              </select>
            </div>
            {createError && (
              <p className="text-red-600 text-sm">Error: {createError}</p>
            )}
            <div className="flex gap-2">
              <Button onClick={handleCreate} loading={createRequest.isPending} disabled={!targetUserId || !actionTypeId}>
                Enviar
              </Button>
              <Button variant="outline" onClick={() => { setShowCreate(false); setCreateError(null); }}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-2 rounded-lg font-medium ${tab === 'pending' ? 'bg-app-accent text-white' : 'bg-app-bg text-app-muted'}`}
        >
          Pendientes ({pendingRequests.length})
        </button>
        <button
          onClick={() => setTab('resolved')}
          className={`px-4 py-2 rounded-lg font-medium ${tab === 'resolved' ? 'bg-app-accent text-white' : 'bg-app-bg text-app-muted'}`}
        >
          Resueltas ({resolvedRequests.length})
        </button>
      </div>

      <div className="space-y-3">
        {requestsToShow.map((req: {
          id: string
          status: string
          requester_id: string
          target_user_id: string
          action_types?: { name: string; points_value: number }
          requester?: { name: string }
          created_at: string
          expires_at: string
          points_cost: number
          reward_amount: number
        }) => {
          const isTarget = req.target_user_id === profile?.id
          const isRequester = req.requester_id === profile?.id
          const isPending = req.status === 'pending'
          const expired = new Date(req.expires_at) < new Date()

          return (
            <div
              key={req.id}
              className="p-4 bg-app-surface rounded-xl border border-app-border"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-app-foreground">
                    {req.action_types?.name} — {isTarget ? `De: ${(req as { requester?: { name: string } }).requester?.name ?? 'Usuario'}` : `Para: ${(req as { target?: { name: string } }).target?.name ?? 'Usuario'}`}
                  </p>
                  <p className="text-sm text-app-muted mt-1">
                    {formatDateTime(req.created_at)} · {req.points_cost} pts / recompensa: {req.reward_amount} pts
                  </p>
                  <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded ${
                    req.status === 'pending' ? 'bg-amber-900/60 text-amber-200' :
                    req.status === 'accepted' ? 'bg-green-900/60 text-green-200' :
                    req.status === 'rejected' ? 'bg-red-900/60 text-red-200' :
                    req.status === 'cancelled' ? 'bg-slate-600 text-slate-300' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {({ pending: 'Pendiente', accepted: 'Aceptado', rejected: 'Rechazado', expired: 'Caducado', cancelled: 'Cancelada' })[req.status] ?? req.status}
                  </span>
                </div>
                {isTarget && isPending && !expired && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAccept(req.id)} loading={acceptRequest.isPending}>
                      Aceptar
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleReject(req.id)} loading={rejectRequest.isPending}>
                      Rechazar
                    </Button>
                  </div>
                )}
                {isRequester && isPending && !expired && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleCancel(req.id)} loading={cancelRequest.isPending}>
                      Cancelar solicitud
                    </Button>
                  </div>
                )}
                {!isPending && (isTarget || isRequester) && (
                  <Button size="sm" variant="outline" onClick={() => setRevertRequestId(req.id)} loading={revertRequest.isPending}>
                    Revertir
                  </Button>
                )}
              </div>
            </div>
          )
        })}
        {requestsToShow.length === 0 && (
          <p className="text-app-muted text-center py-8">No hay solicitudes</p>
        )}
      </div>

      {revertRequestId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => !revertRequest.isPending && setRevertRequestId(null)}>
          <div className="bg-app-surface rounded-2xl border border-app-border p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-app-foreground mb-2">Revertir solicitud</h3>
            <p className="text-sm text-app-muted mb-4">
              Se restablecerán los puntos que esta solicitud haya sumado o restado a los usuarios involucrados y se eliminará la solicitud del historial. Esta acción no se puede deshacer.
            </p>
            <p className="text-sm text-app-foreground mb-4">
              ¿Quieres continuar?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRevertRequestId(null)} disabled={revertRequest.isPending}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleRevertConfirm} loading={revertRequest.isPending}>
                Aceptar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
