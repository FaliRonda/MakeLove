import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Layout } from '@/components/layout/Layout'
import { Login } from '@/pages/Login'
import { Register } from '@/pages/Register'
import { Dashboard } from '@/pages/Dashboard'
import { Actions } from '@/pages/Actions'
import { ActionDetail } from '@/pages/ActionDetail'
import { ActionDetailView } from '@/pages/ActionDetailView'
import { Calendar } from '@/pages/Calendar'
import { Requests } from '@/pages/Requests'
import { Notifications } from '@/pages/Notifications'
import { Profile } from '@/pages/Profile'
import { Historia } from '@/pages/Historia'
import { Tienda } from '@/pages/Tienda'
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { ActionsManage } from '@/pages/admin/ActionsManage'
import { UsersManage } from '@/pages/admin/UsersManage'
import { CouplesManage } from '@/pages/admin/CouplesManage'
import { HistoriaManage } from '@/pages/admin/HistoriaManage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

function AppRoutes() {
  const { pathname } = useLocation()
  const { loading, isAuthenticated, loadError } = useAuth()

  // En /login y /register: mostrar formulario aunque cargue (evita bloqueo)
  const showAuthForms = pathname === '/login' || pathname === '/register'
  const blockOnLoading = loading && !showAuthForms

  if (blockOnLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg">
        <div className="animate-pulse text-app-accent">Cargando...</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login loadError={loadError} />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <Register loadError={loadError} />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="actions" element={<Actions />} />
        <Route path="actions/:id" element={<ActionDetail />} />
        <Route path="actions/:id/history" element={<ActionDetailView />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="requests" element={<Requests />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="historia" element={<Historia />} />
        <Route path="tienda" element={<Tienda />} />
        <Route path="profile" element={<Profile />} />
        <Route path="profile/:userId" element={<Profile />} />
      </Route>

      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="actions" element={<ActionsManage />} />
          <Route path="couples" element={<CouplesManage />} />
          <Route path="historia" element={<HistoriaManage />} />
          <Route path="users" element={<UsersManage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
