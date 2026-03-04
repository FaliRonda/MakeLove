import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Nav } from './Nav'

export function Layout() {
  const location = useLocation()
  const isAdminRoute = location.pathname.startsWith('/admin')

  return (
    <div className="min-h-screen bg-app-bg flex flex-col">
      <Header />
      <main className="flex-1 p-4 pb-24 max-w-2xl mx-auto w-full">
        <Outlet />
      </main>
      {!isAdminRoute && <Nav />}
    </div>
  )
}
