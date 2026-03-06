import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, getRestHeaders } from '@/lib/supabase'
import type { User } from '@/types'

export function useUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      if (!userId) return null
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(
          `${h.url}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
          { headers: { apikey: h.key, Authorization: `Bearer ${h.token}` } }
        )
        if (!res.ok) return null
        const data = await res.json()
        const arr = Array.isArray(data) ? data : []
        return (arr[0] ?? null) as User | null
      }
      if (!supabase) return null
      const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle()
      if (error) throw error
      return (data ?? null) as User | null
    },
    enabled: !!userId,
  })
}

export function useUsers(adminOnly = false) {
  return useQuery({
    queryKey: ['users', adminOnly],
    queryFn: async () => {
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(
          `${h.url}/rest/v1/users?order=name.asc&select=*`,
          { headers: { apikey: h.key, Authorization: `Bearer ${h.token}` } }
        )
        if (!res.ok) return []
        const data = await res.json()
        return (Array.isArray(data) ? data : []) as User[]
      }
      if (!supabase) return []
      const { data, error } = await supabase.from('users').select('*').order('name')
      if (error) throw error
      return (data ?? []) as User[]
    },
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      name,
      email,
      points_balance,
      is_admin,
      avatar_url,
      estado,
    }: Partial<User> & { id: string }) => {
      const h = getRestHeaders()
      const body: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (name !== undefined) body.name = name
      if (email !== undefined) body.email = email
      if (points_balance !== undefined) body.points_balance = points_balance
      if (is_admin !== undefined) body.is_admin = is_admin
      if (avatar_url !== undefined) body.avatar_url = avatar_url
      if (estado !== undefined) body.estado = estado
      if (h) {
        const res = await fetch(`${h.url}/rest/v1/users?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: h.key,
            Authorization: `Bearer ${h.token}`,
          },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const text = await res.text()
          let msg = `Error ${res.status}`
          try {
            const j = JSON.parse(text)
            if (j?.message) msg = j.message
          } catch { /* ignore */ }
          throw new Error(msg)
        }
        return
      }
      if (!supabase) throw new Error('Supabase no configurado')
      const { error } = await supabase
        .from('users')
        .update({
          ...(name !== undefined && { name }),
          ...(email !== undefined && { email }),
          ...(points_balance !== undefined && { points_balance }),
          ...(is_admin !== undefined && { is_admin }),
          ...(avatar_url !== undefined && { avatar_url }),
          ...(estado !== undefined && { estado }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
