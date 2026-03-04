import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

export function Profile() {
  const { profile, signOut, refetchProfile, user } = useAuth()

  return (
    <div className="space-y-6">
      <div className="bg-app-surface rounded-2xl p-6 shadow-sm border border-app-border">
        <h2 className="text-lg font-semibold text-app-foreground">Mi perfil</h2>
        <dl className="mt-4 space-y-3">
          <div>
            <dt className="text-sm text-app-muted">Nombre</dt>
            <dd className="font-medium text-app-foreground-dark">{profile?.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-app-muted">Email</dt>
            <dd className="font-medium text-app-foreground-dark">{profile?.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-app-muted">Saldo</dt>
            <dd className="font-bold text-app-muted text-xl">{profile?.points_balance} puntos</dd>
          </div>
          {profile?.created_at && (
            <div>
              <dt className="text-sm text-app-muted">Miembro desde</dt>
              <dd className="font-medium text-app-foreground-dark">{formatDate(profile.created_at)}</dd>
            </div>
          )}
        </dl>
        <div className="mt-6 pt-6 border-t border-app-border flex flex-wrap gap-2">
          {!profile && user && (
            <Button variant="secondary" size="sm" onClick={() => refetchProfile()}>
              Reintentar cargar perfil
            </Button>
          )}
          <Button variant="outline" onClick={() => signOut()} className="w-full sm:w-auto">
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  )
}
