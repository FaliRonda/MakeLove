import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useActiveActionTypes } from '@/hooks/useActions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function Actions() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    name: '',
    points_value: 10,
  })
  const { data: actions = [], isLoading, error } = useActiveActionTypes()

  // Si el usuario abrió el formulario, mostrarlo aunque esté cargando o haya error
  const showForm = showCreate
  if (isLoading && !showForm) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-app-foreground">Acciones</h1>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>Crear nueva acción</Button>
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-app-surface-alt rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error && !showForm) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-app-foreground">Acciones</h1>
          <Button size="sm" onClick={() => setShowCreate(true)}>Crear nueva acción</Button>
        </div>
        <p className="text-red-600">Error al cargar acciones</p>
      </div>
    )
  }

  const handleCreate = async () => {
    setCreateError(null)
    setCreating(true)
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    const projectRef = url?.replace(/^https?:\/\//, '').split('.')[0]
    const storageKey = projectRef ? `sb-${projectRef}-auth-token` : null
    const raw = storageKey ? (localStorage.getItem(storageKey) ?? sessionStorage.getItem(storageKey)) : null
    let token = ''
    try {
      const parsed = raw ? JSON.parse(raw) : null
      token = parsed?.access_token ?? ''
    } catch { /* ignore */ }
    if (!url || !key || !token) {
      setCreateError('No hay sesión. Vuelve a iniciar sesión.')
      setCreating(false)
      return
    }
    try {
      const res = await fetch(`${url}/rest/v1/action_types`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: key,
          Authorization: `Bearer ${token}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          name: form.name.trim(),
          description: '',
          points_value: form.points_value,
          reward_percentage: null,
          is_active: true,
        }),
      })
      const text = await res.text()
      if (!res.ok) {
        let msg = `Error ${res.status}`
        try {
          const j = JSON.parse(text)
          if (j?.message) msg = j.message
        } catch { /* ignore */ }
        setCreateError(msg)
        setCreating(false)
        return
      }
      setForm({ name: '', points_value: 10 })
      setShowCreate(false)
      // Actualizar la caché con la acción creada (Supabase devuelve la fila con Prefer: return=representation)
      try {
        const created = JSON.parse(text)
        const newAction = Array.isArray(created) ? created[0] : created
        if (newAction?.id) {
          queryClient.setQueryData<typeof actions>(['action_types', 'active'], (prev = []) => {
            const next = [...prev, newAction].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            return next
          })
          queryClient.setQueryData(['action_types'], (prev: typeof actions = []) => {
            const next = [...prev, newAction].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            return next
          })
        }
      } catch { /* ignore */ }
      queryClient.invalidateQueries({ queryKey: ['action_types'] })
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Error de red al crear')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-app-foreground">Acciones</h1>
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancelar' : 'Crear nueva acción'}
        </Button>
      </div>

      {showCreate && (
        <div className="bg-app-surface rounded-2xl p-6 border border-app-border">
          <h2 className="font-semibold text-app-foreground mb-4">Nueva acción</h2>
          <div className="space-y-3">
            <Input
              label="Nombre"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ej. Hacer la compra"
              required
            />
            <Input
              label="Puntos"
              type="number"
              min={1}
              value={form.points_value}
              onChange={(e) => setForm((f) => ({ ...f, points_value: Number(e.target.value) }))}
            />
            {createError && (
              <p className="text-red-600 text-sm">Error: {createError}. Si es un error de permisos, ejecuta en Supabase la migración 005 (Action types: usuarios pueden insertar).</p>
            )}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleCreate}
                loading={creating}
                disabled={!form.name.trim() || form.points_value < 1}
              >
                Crear
              </Button>
              <Button variant="outline" onClick={() => { setShowCreate(false); setCreateError(null); }}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {actions.map((action) => (
          <Link
            key={action.id}
            to={`/actions/${action.id}`}
            className="block p-4 bg-app-surface rounded-xl border border-app-border hover:border-app-border-hover hover:shadow-sm transition-all"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-app-foreground">{action.name}</h3>
                {action.description && (
                  <p className="text-sm text-app-muted mt-1">{action.description}</p>
                )}
              </div>
              <span className="text-app-accent font-bold">+{action.points_value} pts</span>
            </div>
          </Link>
        ))}
        {actions.length === 0 && !showCreate && (
          <div className="bg-app-surface rounded-2xl border border-app-border p-8 text-center">
            <p className="text-app-foreground font-semibold text-lg">Crea una nueva acción</p>
            <p className="text-app-muted text-sm mt-2">Aún no hay acciones. Usa el botón «Crear nueva acción» de arriba para añadir la primera.</p>
            <Button className="mt-4" onClick={() => setShowCreate(true)}>Crear nueva acción</Button>
          </div>
        )}
      </div>
    </div>
  )
}
