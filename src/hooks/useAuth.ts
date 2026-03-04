import { useEffect, useState } from 'react'
import { supabase, getRestHeaders } from '@/lib/supabase'
import type { User } from '@/types'

export function useAuth() {
  const [authUser, setAuthUser] = useState<{ id: string } | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const client = supabase
    if (!client) {
      setLoading(false)
      return
    }

    const getProfileWithFetch = async (userId: string, token: string): Promise<User | null> => {
      const url = import.meta.env.VITE_SUPABASE_URL
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY
      if (!url || !key) return null
      try {
        const res = await fetch(
          `${url}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=*`,
          { headers: { apikey: key, Authorization: `Bearer ${token}` } }
        )
        if (!res.ok) return null
        const data = await res.json()
        const p = Array.isArray(data) ? data[0] : data
        return (p as User) ?? null
      } catch {
        return null
      }
    }

    const ensureMyProfileRpc = async (token: string): Promise<void> => {
      const url = import.meta.env.VITE_SUPABASE_URL
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY
      if (!url || !key) return
      await fetch(`${url}/rest/v1/rpc/ensure_my_profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      })
    }

    const getProfile = async (userId: string) => {
      const { data, error } = await client.from('users').select('*').eq('id', userId).single()
      if (error) console.error('[MakeLove] getProfile error:', error.message, 'code:', error.code)
      return data as User | null
    }

    const ensureAndGetProfile = async (userId: string) => {
      const h = getRestHeaders()
      if (h) {
        let p = await getProfileWithFetch(userId, h.token)
        if (!p) {
          await ensureMyProfileRpc(h.token)
          p = await getProfileWithFetch(userId, h.token)
        }
        return p
      }
      let p = await getProfile(userId)
      if (!p) {
        const { error } = await client.rpc('ensure_my_profile')
        if (error) console.error('[MakeLove] ensure_my_profile error:', error.message, error.code)
        p = await getProfile(userId)
      }
      return p
    }

    const init = async () => {
      try {
        // Ruta rápida: leer sesión de localStorage o sessionStorage (Supabase puede usar cualquiera)
        const url = import.meta.env.VITE_SUPABASE_URL
        const projectRef = url?.replace(/^https?:\/\//, '').split('.')[0]
        const storageKey = projectRef ? `sb-${projectRef}-auth-token` : null
        const raw = storageKey
          ? (localStorage.getItem(storageKey) ?? sessionStorage.getItem(storageKey))
          : null
        let parsed: { access_token?: string; user?: { id: string } } | null = null
        try {
          parsed = raw ? JSON.parse(raw) : null
        } catch {
          parsed = null
        }
        const u = parsed?.access_token && parsed?.user ? parsed.user : null
        if (u) {
          console.log('[MakeLove Paso 2] Init: sesión en storage. User id:', u.id)
          setAuthUser({ id: u.id })
          setLoading(false)
          const key = import.meta.env.VITE_SUPABASE_ANON_KEY
          // Paso 3: pedir perfil con fetch y el token que ya tenemos (evita depender del cliente Supabase que puede colgarse)
          const loadProfile = async (): Promise<User | null> => {
            if (!url || !key || !parsed?.access_token) return null
            try {
              const res = await fetch(
                `${url}/rest/v1/users?id=eq.${encodeURIComponent(u.id)}&select=*`,
                {
                  headers: {
                    'Content-Type': 'application/json',
                    apikey: key,
                    Authorization: `Bearer ${parsed.access_token}`,
                  },
                }
              )
              if (!res.ok) {
                console.error('[MakeLove] getProfile fetch:', res.status, await res.text())
                return null
              }
              const data = await res.json()
              const p = Array.isArray(data) ? data[0] : data
              return (p as User) ?? null
            } catch (err) {
              console.error('[MakeLove] getProfile fetch error:', err)
              return null
            }
          }
          loadProfile().then((p) => {
            if (p) {
              console.log('[MakeLove Paso 3] Perfil cargado (fetch):', p.name, p.email, p.points_balance, 'puntos')
              setProfile(p)
              return
            }
            // Sin perfil: intentar ensure_my_profile vía fetch y volver a pedir
            const h = getRestHeaders()
            if (h) {
              fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/ensure_my_profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', apikey: h.key, Authorization: `Bearer ${h.token}` },
                body: '{}',
              }).then(() =>
                loadProfile().then((p2) => {
                  console.log('[MakeLove Paso 3] Perfil después de ensure_my_profile:', p2 ? `${p2.name}, ${p2.points_balance} pts` : 'null')
                  setProfile(p2)
                })
              ).catch((e: unknown) => {
                console.error('[MakeLove] ensure_my_profile:', e)
                setProfile(null)
              })
            } else {
              Promise.resolve(
                client.rpc('ensure_my_profile').then(() =>
                  loadProfile().then((p2) => {
                    setProfile(p2)
                  })
                )
              ).catch((e: unknown) => {
                console.error('[MakeLove] ensure_my_profile:', e)
                setProfile(null)
              })
            }
          })
          return
        }
        // Sin sesión en storage: usar Supabase (puede ser lento)
        const { data: { session } } = await client.auth.getSession()
        const sessionUser = session?.user
        if (sessionUser) {
          setAuthUser({ id: sessionUser.id })
          setLoading(false)
          ensureAndGetProfile(sessionUser.id).then((p) => setProfile(p)).catch(() => setProfile(null))
        } else {
          setProfile(null)
          setAuthUser(null)
          setLoading(false)
        }
      } catch (err) {
        console.error('Auth init error:', err)
        setProfile(null)
        setAuthUser(null)
        setLoading(false)
      }
    }

    // Timeout: si init tarda más de 25s (Auth puede ser lento en primer request), mostrar login
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      setLoadError('La verificación de sesión tardó. Usa "Probar conexión" para comprobar si Supabase responde.')
      setLoading(false)
      setProfile(null)
      setAuthUser(null)
    }, 25000)

    init().finally(() => {
      clearTimeout(timeout)
      if (!timedOut) setLoadError(null)
    })

    const { data: { subscription } } = client.auth.onAuthStateChange(async (_, session) => {
      if (session?.user) {
        try {
          const p = await ensureAndGetProfile(session.user.id)
          setProfile(p)
        } catch {
          setProfile(null)
        }
        setAuthUser({ id: session.user.id })
      } else {
        setProfile(null)
        setAuthUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const refetchProfile = async () => {
    const h = getRestHeaders()
    if (!authUser) return
    if (h) {
      let p = await (async () => {
        const res = await fetch(
          `${h.url}/rest/v1/users?id=eq.${encodeURIComponent(authUser.id)}&select=*`,
          { headers: { apikey: h.key, Authorization: `Bearer ${h.token}` } }
        )
        if (!res.ok) return null
        const data = await res.json()
        return (Array.isArray(data) ? data[0] : data) as User | null
      })()
      if (!p) {
        await fetch(`${h.url}/rest/v1/rpc/ensure_my_profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: h.key, Authorization: `Bearer ${h.token}` },
          body: '{}',
        })
        const res2 = await fetch(
          `${h.url}/rest/v1/users?id=eq.${encodeURIComponent(authUser.id)}&select=*`,
          { headers: { apikey: h.key, Authorization: `Bearer ${h.token}` } }
        )
        if (res2.ok) {
          const data2 = await res2.json()
          p = (Array.isArray(data2) ? data2[0] : data2) as User | null
        }
      }
      setProfile(p)
      return
    }
    if (!supabase) return
    let data = (await supabase.from('users').select('*').eq('id', authUser.id).single()).data
    if (!data) {
      await supabase.rpc('ensure_my_profile')
      data = (await supabase.from('users').select('*').eq('id', authUser.id).single()).data
    }
    setProfile(data as User | null)
  }

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase no configurado')
    const url = import.meta.env.VITE_SUPABASE_URL
    console.log('[MakeLove] Iniciando login a', url)
    const timeoutMs = 30000
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(
        'La conexión con Supabase tardó demasiado. Verifica: 1) URL en .env (https://tu-proyecto.supabase.co) 2) Clave anon correcta 3) Proyecto no pausado en supabase.com'
      )), timeoutMs)
    )
    try {
      const result = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        timeoutPromise,
      ]) as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>
      if (result.error) {
        console.error('[MakeLove] Error de Supabase:', result.error)
        throw result.error
      }
      console.log('[MakeLove] Login OK:', result.data?.user?.email)
    } catch (err) {
      console.error('[MakeLove] Login falló:', err)
      throw err
    }
  }

  const signUp = async (email: string, password: string, name: string) => {
    if (!supabase) throw new Error('Supabase no configurado')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    if (error) throw error
  }

  const signOut = () => {
    // Limpiar localStorage y recargar para que toda la app vea sesión cerrada
    const url = import.meta.env.VITE_SUPABASE_URL
    const projectRef = url?.replace(/^https?:\/\//, '').split('.')[0]
    const storageKey = projectRef ? `sb-${projectRef}-auth-token` : null
    if (storageKey) {
      localStorage.removeItem(storageKey)
      sessionStorage.removeItem(storageKey)
    }
    if (supabase) supabase.auth.signOut().catch(() => {})
    window.location.href = '/login'
  }

  return {
    user: authUser,
    profile,
    loading,
    loadError,
    refetchProfile,
    signIn,
    signUp,
    signOut,
    isAuthenticated: !!authUser,
    isAdmin: profile?.is_admin ?? false,
  }
}
