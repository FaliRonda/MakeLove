import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function Register({ loadError }: { loadError?: string | null }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await signUp(email, password, name)
      setSuccess(true)
      setTimeout(() => navigate('/'), 1500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrarse')
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-2xl border border-violet-400/10 bg-app-surface/45 backdrop-blur-xl px-8 py-10 shadow-card text-center">
          <img
            src="/pinguslove-icon.png"
            alt=""
            className="h-20 w-20 mx-auto object-contain drop-shadow-[0_8px_24px_rgba(124,58,237,0.35)]"
          />
          <h2 className="text-xl font-bold text-app-foreground mt-4">¡Cuenta creada!</h2>
          <p className="text-app-muted mt-2">Recibirás 100 puntos al empezar. Redirigiendo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-violet-400/10 bg-app-surface/45 backdrop-blur-xl p-6 sm:p-8 shadow-card space-y-6">
        <div className="text-center">
          <img
            src="/pinguslove-icon.png"
            alt=""
            className="h-24 w-24 mx-auto object-contain drop-shadow-[0_8px_24px_rgba(124,58,237,0.35)]"
          />
          <h1 className="text-2xl font-bold text-app-foreground mt-3 tracking-tight">PingusLove</h1>
          <p className="text-app-muted text-sm mt-1">Crea tu cuenta (100 pts de bienvenida)</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
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
            minLength={6}
            autoComplete="new-password"
          />
          {loadError && (
            <p className="text-sm text-amber-100 bg-amber-950/50 p-3 rounded-xl border border-amber-500/30">{loadError}</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" size="lg">
            Registrarse
          </Button>
        </form>
        <p className="text-center text-sm text-app-muted pt-2 border-t border-app-border/60">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-semibold text-sky-400 hover:text-sky-300 underline underline-offset-2">
            Entra
          </Link>
        </p>
      </div>
    </div>
  )
}
