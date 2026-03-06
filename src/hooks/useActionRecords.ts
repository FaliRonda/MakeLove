import { useQuery } from '@tanstack/react-query'
import { supabase, getRestHeaders } from '@/lib/supabase'
import type { ActionRecord } from '@/types'

const SELECT_RECORDS = '*,action_types(id,name,points_value),users(id,name)'

interface UseActionRecordsOptions {
  userId?: string
  actionTypeId?: string
  from?: Date
  to?: Date
  enabled?: boolean
}

export function useActionRecords(options: UseActionRecordsOptions = {}) {
  const { userId, actionTypeId, from, to, enabled = true } = options

  return useQuery({
    queryKey: ['action_records', userId, actionTypeId, from?.toISOString(), to?.toISOString()],
    queryFn: async () => {
      const h = getRestHeaders()
      if (h) {
        const params = new URLSearchParams({
          select: SELECT_RECORDS,
          order: 'performed_at.desc',
          limit: '500',
        })
        if (userId) params.set('user_id', `eq.${userId}`)
        if (actionTypeId) params.set('action_type_id', `eq.${actionTypeId}`)
        if (from) params.set('performed_at', `gte.${from.toISOString()}`)
        if (to) params.append('performed_at', `lte.${to.toISOString()}`)
        const res = await fetch(`${h.url}/rest/v1/action_records?${params}`, {
          headers: { apikey: h.key, Authorization: `Bearer ${h.token}` },
        })
        if (!res.ok) return []
        const data = await res.json()
        return (Array.isArray(data) ? data : []) as ActionRecord[]
      }
      if (!supabase) return []
      let q = supabase
        .from('action_records')
        .select(`*,action_types(id,name,points_value),users(id,name)`)
        .order('performed_at', { ascending: false })
      if (userId) q = q.eq('user_id', userId)
      if (actionTypeId) q = q.eq('action_type_id', actionTypeId)
      if (from) q = q.gte('performed_at', from.toISOString())
      if (to) q = q.lte('performed_at', to.toISOString())
      const { data, error } = await q.limit(500)
      if (error) throw error
      return (data ?? []) as ActionRecord[]
    },
    enabled: enabled && (!!getRestHeaders() || !!supabase),
  })
}
