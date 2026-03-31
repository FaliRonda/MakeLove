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
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pt-1 pointer-events-none">
      <div className="pointer-events-auto max-w-2xl mx-auto rounded-2xl border border-violet-400/10 bg-app-surface/88 backdrop-blur-xl shadow-nav">
        <div className="flex px-1 py-1.5 gap-0.5">
          {navItems.map(({ to, label, icon }) => {
            const active =
              location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 px-1 py-2 rounded-xl text-[11px] sm:text-xs font-semibold transition-all min-w-0',
                  active
                    ? 'text-sky-300 bg-sky-400/10 shadow-sm ring-1 ring-sky-400/25'
                    : 'text-app-muted hover:text-app-foreground hover:bg-white/[0.04]'
                )}
              >
                <span className="text-base leading-none">{icon}</span>
                <span className="truncate w-full text-center leading-tight">{label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
