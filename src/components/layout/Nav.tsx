import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Inicio', icon: '🏠' },
  { to: '/actions', label: 'Acciones', icon: '✓' },
  { to: '/requests', label: 'Solicitudes', icon: '📨' },
  { to: '/historia', label: 'Historia', icon: '✨' },
  { to: '/tienda', label: 'Tienda', icon: '💎' },
]

export function Nav() {
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-app-surface border-t border-app-border z-40">
      <div className="max-w-2xl mx-auto px-1 py-1 flex">
        {navItems.map(({ to, label, icon }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 px-1 py-2 rounded-lg text-xs font-medium transition-colors min-w-0',
              location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
                ? 'text-app-muted bg-app-bg'
                : 'text-app-accent hover:bg-app-bg/50'
            )}
          >
            <span className="text-base leading-none">{icon}</span>
            <span className="truncate w-full text-center leading-tight">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
