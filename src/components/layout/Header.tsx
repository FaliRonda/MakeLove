import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useUnreadCount } from '@/hooks/useNotifications'
import { Button } from '@/components/ui/Button'

export function Header() {
  const { profile, signOut, isAdmin } = useAuth()
  const { data: unreadCount = 0 } = useUnreadCount(profile?.id)

  return (
    <header className="sticky top-0 z-50 bg-app-surface/95 backdrop-blur border-b border-app-border">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-app-foreground font-bold text-xl">
          <span className="text-2xl">♥</span>
          MakeLove
        </Link>
        <div className="flex items-center gap-2">
          {profile && (
            <>
              <span className="text-sm text-app-muted font-medium hidden sm:inline">
                {profile.points_balance} pts
              </span>
              <Link
                to="/notifications"
                className="relative p-2 rounded-full hover:bg-app-bg text-app-muted"
                aria-label="Notificaciones"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 size-5 bg-app-accent text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              {isAdmin && (
                <Link to="/admin" className="text-app-muted hover:text-app-foreground text-sm font-medium">
                  Admin
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                Salir
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
