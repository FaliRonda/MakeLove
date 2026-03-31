import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function Login({ loadError }: { loadError?: string | null }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [connectionTest, setConnectionTest] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle')
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const testConnection = async () => {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) {
      setConnectionTest('fail')
      setError('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env')
      return
    }
    setConnectionTest('checking')
    setError('')
    try {
      // Probar REST y Auth (login usa Auth)
      const [restRes, authRes] = await Promise.all([
        fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
        fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } }),
      ])
      // Cualquier respuesta significa que el servidor responde (no timeout/CORS)
      const restReached = restRes.status > 0
      const authReached = authRes.status > 0
      if (restReached && authReached) {
        setConnectionTest('ok')
      } else {
        setConnectionTest('fail')
        const errs = []
        if (!restReached) errs.push(`REST: ${restRes.status}`)
        if (!authReached) errs.push(`Auth: ${authRes.status}`)
        setError(errs.join(' · '))
      }
    } catch (err) {
      setConnectionTest('fail')
      setError(err instanceof Error ? err.message : 'Error de red o CORS')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      // Intentar primero con fetch directo (evita posibles problemas con supabase-js)
      const url = import.meta.env.VITE_SUPABASE_URL
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY
      if (url && key) {
        const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: key,
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({ email, password }),
        })
        const data = await res.json().catch(() => ({}))
        if (data.access_token) {
          // Paso 1: Login OK — Supabase devolvió token
          console.log('[MakeLove Paso 1] Login OK. User id:', data.user?.id, '| Email:', data.user?.email)
          const projectRef = url.replace(/^https?:\/\//, '').split('.')[0]
          const expiresAt = data.expires_at ?? (Math.floor(Date.now() / 1000) + (data.expires_in || 3600))
          const sessionData = {
            access_token: data.access_token,
            refresh_token: data.refresh_token || '',
            expires_at: expiresAt,
            expires_in: data.expires_in || 3600,
            token_type: data.token_type || 'bearer',
            user: data.user,
          }
          // Guardar en localStorage (formato que Supabase lee al cargar)
          localStorage.setItem(`sb-${projectRef}-auth-token`, JSON.stringify(sessionData))
          window.location.href = '/'
          return
        }
        if (data.error_description || data.msg) {
          throw new Error(data.error_description || data.msg)
        }
        if (!res.ok) throw new Error(`Error ${res.status}`)
      }
      // Fallback a supabase-js
      await signIn(email, password)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg === 'Supabase no configurado' ? 'Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env (ver README)' : msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-app-bg">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/pinguslove-icon.png" alt="PingusLove" className="h-24 w-24 mx-auto object-contain" />
          <h1 className="text-2xl font-bold text-app-foreground mt-3">PingusLove</h1>
          <p className="text-app-muted text-sm mt-1">Inicia sesión en tu cuenta</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {loadError && connectionTest !== 'ok' && (
            <p className="text-sm text-amber-200 bg-amber-900/40 p-3 rounded-lg border border-amber-700/50">
              {loadError}
              <span className="block mt-2 text-xs">Haz clic en "Probar conexión" para verificar. Puedes intentar iniciar sesión de todos modos.</span>
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" size="lg" loading={isSubmitting} disabled={isSubmitting}>
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={testConnection}
            disabled={connectionTest === 'checking'}
            className="text-sm text-app-muted hover:underline disabled:opacity-50"
          >
            {connectionTest === 'idle' && 'Probar conexión con Supabase'}
            {connectionTest === 'checking' && 'Comprobando...'}
            {connectionTest === 'ok' && '✓ Conexión OK'}
            {connectionTest === 'fail' && '✗ Falló — haz clic para reintentar'}
          </button>
          <p className="text-center text-sm text-app-muted">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="font-medium text-app-muted hover:text-app-foreground underline">
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
