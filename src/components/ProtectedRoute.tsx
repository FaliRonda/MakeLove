import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function ProtectedRoute({ children, adminOnly }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { profile, loading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg">
        <div className="animate-pulse text-app-accent">Cargando...</div>
      </div>
    )
  }

  // Usar sesión de auth, no profile (el profile puede tardar o fallar si el trigger no creó la fila)
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (adminOnly && !profile?.is_admin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
