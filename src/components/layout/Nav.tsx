import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Inicio', icon: '🏠' },
  { to: '/actions', label: 'Acciones', icon: '✓' },
  { to: '/calendar', label: 'Calendario', icon: '📅' },
  { to: '/requests', label: 'Solicitudes', icon: '📨' },
]

export function Nav() {
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-app-surface border-t border-app-border z-40">
      <div className="max-w-2xl mx-auto px-2 py-2 flex justify-around">
        {navItems.map(({ to, label, icon }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              'flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
                ? 'text-app-muted bg-app-bg'
                : 'text-app-accent hover:bg-app-bg/50'
            )}
          >
            <span className="text-lg">{icon}</span>
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
