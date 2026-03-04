import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useActionTypes } from '@/hooks/useActions'
import { useCreateActionType, useUpdateActionType, useDeleteActionType } from '@/hooks/useAdminActions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function ActionsManage() {
  const [editing, setEditing] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    points_value: 10,
    reward_percentage: '' as string | number,
    is_active: true,
  })

  const { data: actions = [], isLoading } = useActionTypes()
  const createAction = useCreateActionType()
  const updateAction = useUpdateActionType()
  const deleteAction = useDeleteActionType()

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      points_value: 10,
      reward_percentage: '',
      is_active: true,
    })
    setEditing(null)
    setShowCreate(false)
  }

  const handleCreate = async () => {
    try {
      await createAction.mutateAsync({
        name: form.name,
        description: form.description,
        points_value: form.points_value,
        reward_percentage: form.reward_percentage === '' ? null : Number(form.reward_percentage),
        is_active: form.is_active,
      })
      resetForm()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    }
  }

  const handleUpdate = async (id: string) => {
    try {
      await updateAction.mutateAsync({
        id,
        name: form.name,
        description: form.description,
        points_value: form.points_value,
        reward_percentage: form.reward_percentage === '' ? null : Number(form.reward_percentage),
        is_active: form.is_active,
      })
      resetForm()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta acción?')) return
    try {
      await deleteAction.mutateAsync(id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    }
  }

  const startEdit = (id: string) => {
    const a = actions.find((x) => x.id === id)
    if (a) {
      setForm({
        name: a.name,
        description: a.description,
        points_value: a.points_value,
        reward_percentage: a.reward_percentage ?? '',
        is_active: a.is_active,
      })
      setEditing(id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-app-foreground">Gestionar acciones</h1>
        <Button size="sm" onClick={() => { setShowCreate(true); setEditing(null); }}>
          Nueva acción
        </Button>
      </div>

      {(showCreate || editing) && (
        <div className="bg-app-surface rounded-2xl p-6 border border-app-border">
          <h2 className="font-semibold text-app-foreground mb-4">
            {editing ? 'Editar acción' : 'Nueva acción'}
          </h2>
          <div className="space-y-3">
            <Input
              label="Nombre"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <Input
              label="Descripción"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <Input
              label="Puntos"
              type="number"
              min={1}
              value={form.points_value}
              onChange={(e) => setForm((f) => ({ ...f, points_value: Number(e.target.value) }))}
            />
            <Input
              label="% Recompensa (opcional)"
              type="number"
              min={0}
              max={100}
              value={form.reward_percentage}
              onChange={(e) => setForm((f) => ({ ...f, reward_percentage: e.target.value }))}
              placeholder="Usar global si vacío"
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              <span className="text-sm text-app-foreground">Activa</span>
            </label>
            <div className="flex gap-2">
              <Button
                onClick={editing ? () => handleUpdate(editing) : handleCreate}
                loading={createAction.isPending || updateAction.isPending}
                disabled={!form.name || form.points_value < 1}
              >
                {editing ? 'Guardar' : 'Crear'}
              </Button>
              <Button variant="outline" onClick={resetForm}>Cancelar</Button>
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
        {!isLoading && actions.map((a) => (
          <div
            key={a.id}
            className="p-4 bg-app-surface rounded-xl border border-app-border flex justify-between items-center"
          >
            <div>
              <span className="font-medium text-app-foreground">{a.name}</span>
              <span className="text-app-accent ml-2">+{a.points_value} pts</span>
              {!a.is_active && <span className="ml-2 text-sm text-app-accent">(inactiva)</span>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => startEdit(a.id)}>Editar</Button>
              <Button size="sm" variant="danger" onClick={() => handleDelete(a.id)}>Eliminar</Button>
            </div>
          </div>
        ))}
        {!isLoading && actions.length === 0 && (
          <p className="text-app-muted">No hay acciones. Crea una con el botón «Nueva acción».</p>
        )}
      </div>

      <Link to="/admin" className="block text-app-muted hover:underline">← Volver al admin</Link>
    </div>
  )
}
