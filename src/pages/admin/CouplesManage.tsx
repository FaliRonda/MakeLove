import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useUsers } from '@/hooks/useUsers'
import { useAdminSetCouple } from '@/hooks/useAdminCouples'
import { Button } from '@/components/ui/Button'

export function CouplesManage() {
  const { data: users = [], isLoading } = useUsers()
  const setCouple = useAdminSetCouple()
  const [userAId, setUserAId] = useState('')
  const [userBId, setUserBId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null)
    if (!userAId || !userBId) {
      setError('Selecciona ambos usuarios.')
      return
    }
    if (userAId === userBId) {
      setError('No puedes asociar un usuario consigo mismo.')
      return
    }

    try {
      await setCouple.mutateAsync({ userAId, userBId })
      setUserAId('')
      setUserBId('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al asociar pareja')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-app-foreground">Gestionar parejas</h1>
        <p className="text-sm text-app-muted mt-1">Asocia dos usuarios. Si uno ya estaba en pareja, se reemplaza.</p>
      </div>

      <div className="bg-app-surface rounded-2xl p-6 border border-app-border space-y-4">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-12 bg-app-surface-alt rounded-xl" />
            <div className="h-12 bg-app-surface-alt rounded-xl" />
          </div>
        ) : (
          <>
            <label className="block">
              <span className="text-sm text-app-muted font-medium">Usuario A</span>
              <select
                value={userAId}
                onChange={(e) => setUserAId(e.target.value)}
                className="mt-1 w-full px-4 py-2 rounded-lg border border-app-border-hover bg-app-surface text-app-foreground"
              >
                <option value="">Selecciona...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-app-muted font-medium">Usuario B</span>
              <select
                value={userBId}
                onChange={(e) => setUserBId(e.target.value)}
                className="mt-1 w-full px-4 py-2 rounded-lg border border-app-border-hover bg-app-surface text-app-foreground"
              >
                <option value="">Selecciona...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => void handleSubmit()}
                loading={setCouple.isPending}
                disabled={!userAId || !userBId || setCouple.isPending}
              >
                Asociar pareja
              </Button>
              <Button variant="outline" onClick={() => { setUserAId(''); setUserBId(''); setError(null) }} disabled={setCouple.isPending}>
                Cancelar
              </Button>
            </div>
          </>
        )}
      </div>

      <Link to="/admin" className="block text-app-muted hover:underline">
        ← Volver al admin
      </Link>
    </div>
  )
}

