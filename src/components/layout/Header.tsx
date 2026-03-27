import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useUnreadCount } from '@/hooks/useNotifications'
import { Avatar } from '@/components/Avatar'

const LOGO_SRC = '/pinguslove-header.png'

export function Header() {
  const { profile } = useAuth()
  const { data: unreadCount = 0 } = useUnreadCount(profile?.id)
  const [logoError, setLogoError] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-app-surface/95 backdrop-blur border-b border-app-border">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-1.5 sm:gap-2 text-app-foreground font-bold text-lg sm:text-xl min-w-0 pr-2"
        >
          {!logoError ? (
            <img
              src={LOGO_SRC}
              alt=""
              className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 object-contain"
              onError={() => setLogoError(true)}
            />
          ) : (
            <span className="text-2xl shrink-0">♥</span>
          )}
          <span className="truncate">PingusLove</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
          {profile && (
            <>
              <span className="text-xs sm:text-sm text-app-muted font-medium tabular-nums whitespace-nowrap shrink-0">
                {profile.points_balance} pts
                <span className="mx-0.5 sm:mx-1 text-app-border">|</span>
                {profile.piedritas_balance ?? 0} 💎
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
              <Link
                to="/profile"
                className="rounded-full transition-opacity hover:opacity-90"
                title="Ir a mi perfil"
                aria-label="Ir a mi perfil"
              >
                <Avatar
                  avatarUrl={
                    profile.avatar_url
                      ? `${profile.avatar_url}?t=${profile.updated_at || ''}`
                      : null
                  }
                  name={profile.name}
                  size="sm"
                  className="border border-app-border"
                />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
