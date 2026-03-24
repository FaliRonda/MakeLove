import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, getRestHeaders } from '@/lib/supabase'
import type { ActionType } from '@/types'

export function useActionTypes() {
  return useQuery({
    queryKey: ['action_types'],
    queryFn: async () => {
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(
          `${h.url}/rest/v1/action_types?order=name.asc&select=*`,
          { headers: { apikey: h.key, Authorization: `Bearer ${h.token}` } }
        )
        if (!res.ok) return []
        const data = await res.json()
        return (Array.isArray(data) ? data : []) as ActionType[]
      }
      if (!supabase) return []
      const { data, error } = await supabase.from('action_types').select('*').order('name')
      if (error) throw error
      return (data ?? []) as ActionType[]
    },
  })
}

export function useActiveActionTypes() {
  return useQuery({
    queryKey: ['action_types', 'active'],
    queryFn: async () => {
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(
          `${h.url}/rest/v1/action_types?is_active=eq.true&order=name.asc&select=*`,
          { headers: { apikey: h.key, Authorization: `Bearer ${h.token}` } }
        )
        if (!res.ok) return []
        const data = await res.json()
        return (Array.isArray(data) ? data : []) as ActionType[]
      }
      if (!supabase) return []
      const { data, error } = await supabase
        .from('action_types')
        .select('*')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return (data ?? []) as ActionType[]
    },
  })
}

export function useMarkActionDone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ actionTypeId, notes }: { actionTypeId: string; notes?: string }) => {
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(`${h.url}/rest/v1/rpc/mark_action_done`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: h.key, Authorization: `Bearer ${h.token}` },
          body: JSON.stringify({ p_action_type_id: actionTypeId, p_notes: notes ?? null }),
        })
        const text = await res.text()
        if (!res.ok) {
          let msg = `Error ${res.status}`
          try {
            const j = JSON.parse(text)
            if (j?.message) msg = j.message
          } catch { /* ignore */ }
          throw new Error(msg)
        }
        try {
          return text ? JSON.parse(text) : null
        } catch {
          return null
        }
      }
      if (!supabase) throw new Error('Supabase no configurado')
      const { data, error } = await supabase.rpc('mark_action_done', {
        p_action_type_id: actionTypeId,
        p_notes: notes ?? null,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action_records'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['weekly_collab_goal'] })
    },
  })
}
