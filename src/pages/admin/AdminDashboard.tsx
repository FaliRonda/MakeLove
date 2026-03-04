import { Link } from 'react-router-dom'

export function AdminDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-app-foreground">Panel de administración</h1>
      <div className="grid gap-4">
        <Link
          to="/admin/actions"
          className="block p-6 bg-app-surface rounded-2xl border border-app-border hover:border-app-border-hover transition-colors"
        >
          <h2 className="font-semibold text-app-foreground">Gestionar acciones</h2>
          <p className="text-sm text-app-muted mt-1">Crear, editar y desactivar acciones predefinidas</p>
        </Link>
        <Link
          to="/admin/users"
          className="block p-6 bg-app-surface rounded-2xl border border-app-border hover:border-app-border-hover transition-colors"
        >
          <h2 className="font-semibold text-app-foreground">Gestionar usuarios</h2>
          <p className="text-sm text-app-muted mt-1">Editar usuarios, puntos y permisos admin</p>
        </Link>
      </div>
      <Link to="/" className="block text-app-muted hover:underline">← Volver al inicio</Link>
    </div>
  )
}
