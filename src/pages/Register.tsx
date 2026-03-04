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
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-app-bg">
        <div className="text-center">
          <span className="text-5xl">♥</span>
          <h2 className="text-xl font-bold text-app-foreground mt-4">¡Cuenta creada!</h2>
          <p className="text-app-muted mt-2">Recibirás 100 puntos al empezar. Redirigiendo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-app-bg">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-5xl">♥</span>
          <h1 className="text-2xl font-bold text-app-foreground mt-2">MakeLove</h1>
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
          {loadError && <p className="text-sm text-amber-200 bg-amber-900/40 p-3 rounded-lg border border-amber-700/50">{loadError}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" size="lg">
            Registrarse
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-app-muted">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-app-muted hover:text-app-foreground underline">
            Entra
          </Link>
        </p>
      </div>
    </div>
  )
}
