import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase no configurado. Crea un archivo .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

/** Token de sesión desde storage (evita depender del cliente Supabase que puede colgarse). */
export function getSessionToken(): string {
  const url = import.meta.env.VITE_SUPABASE_URL
  const projectRef = url?.replace(/^https?:\/\//, '').split('.')[0]
  const storageKey = projectRef ? `sb-${projectRef}-auth-token` : null
  const raw = storageKey ? (localStorage.getItem(storageKey) ?? sessionStorage.getItem(storageKey)) : null
  try {
    const parsed = raw ? JSON.parse(raw) : null
    return parsed?.access_token ?? ''
  } catch {
    return ''
  }
}

export function getRestHeaders(): { url: string; key: string; token: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  const token = getSessionToken()
  if (url && key && token) return { url, key, token }
  return null
}
