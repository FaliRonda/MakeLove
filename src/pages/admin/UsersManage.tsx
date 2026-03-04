import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useUsers } from '@/hooks/useUsers'
import { useUpdateUser } from '@/hooks/useUsers'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function UsersManage() {
  const { data: users = [], isLoading } = useUsers()
  const updateUser = useUpdateUser()
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', points_balance: 0, is_admin: false })

  const startEdit = (id: string) => {
    const u = users.find((x) => x.id === id)
    if (u) {
      setForm({
        name: u.name,
        email: u.email,
        points_balance: u.points_balance,
        is_admin: u.is_admin,
      })
      setEditing(id)
    }
  }

  const handleSave = async () => {
    if (!editing) return
    try {
      await updateUser.mutateAsync({
        id: editing,
        name: form.name,
        email: form.email,
        points_balance: form.points_balance,
        is_admin: form.is_admin,
      })
      setEditing(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-app-foreground">Gestionar usuarios</h1>

      {editing && (
        <div className="bg-app-surface rounded-2xl p-6 border border-app-border">
          <h2 className="font-semibold text-app-foreground mb-4">Editar usuario</h2>
          <div className="space-y-3">
            <Input
              label="Nombre"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Input
              label="Puntos"
              type="number"
              min={0}
              value={form.points_balance}
              onChange={(e) => setForm((f) => ({ ...f, points_balance: Number(e.target.value) }))}
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_admin}
                onChange={(e) => setForm((f) => ({ ...f, is_admin: e.target.checked }))}
              />
              <span className="text-sm text-app-foreground">Admin</span>
            </label>
            <div className="flex gap-2">
              <Button onClick={handleSave} loading={updateUser.isPending}>Guardar</Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {isLoading && (
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-app-surface-alt rounded-xl" />
            ))}
          </div>
        )}
        {!isLoading && users.map((u) => (
          <div
            key={u.id}
            className="p-4 bg-app-surface rounded-xl border border-app-border flex justify-between items-center"
          >
            <div>
              <span className="font-medium text-app-foreground">{u.name}</span>
              <span className="text-app-muted text-sm ml-2">{u.email}</span>
              <span className="text-app-accent ml-2">{u.points_balance} pts</span>
              {u.is_admin && <span className="ml-2 text-xs bg-app-surface-alt text-app-foreground px-2 py-0.5 rounded">Admin</span>}
            </div>
            <Button size="sm" variant="ghost" onClick={() => startEdit(u.id)}>Editar</Button>
          </div>
        ))}
        {!isLoading && users.length === 0 && (
          <p className="text-app-muted">No hay usuarios.</p>
        )}
      </div>

      <Link to="/admin" className="block text-app-muted hover:underline">← Volver al admin</Link>
    </div>
  )
}
