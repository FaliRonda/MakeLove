import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, getRestHeaders } from '@/lib/supabase'
const SELECT_CLAIMS =
  '*,action_types(id,name,points_value),claimer:users!claimer_id(id,name,email)'

export function usePendingClaimsForUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['action_claims', 'pending', userId],
    queryFn: async () => {
      const h = getRestHeaders()
      if (h && userId) {
        const q = new URLSearchParams({
          select: SELECT_CLAIMS,
          target_user_id: `eq.${userId}`,
          status: 'eq.pending',
          order: 'created_at.desc',
        })
        const res = await fetch(`${h.url}/rest/v1/action_claims?${q}`, {
          headers: { apikey: h.key, Authorization: `Bearer ${h.token}` },
        })
        if (!res.ok) return []
        const data = await res.json()
        return Array.isArray(data) ? data : []
      }
      if (!supabase || !userId) return []
      const { data, error } = await supabase
        .from('action_claims')
        .select(`*,action_types(id,name,points_value),claimer:users!claimer_id(id,name,email)`)
        .eq('target_user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!userId,
  })
}

export function useCreateClaim() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      actionTypeId,
      targetUserId,
      notes,
    }: {
      actionTypeId: string
      targetUserId: string
      notes?: string | null
    }) => {
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(`${h.url}/rest/v1/rpc/create_action_claim`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: h.key,
            Authorization: `Bearer ${h.token}`,
          },
          body: JSON.stringify({
            p_action_type_id: actionTypeId,
            p_target_user_id: targetUserId,
            p_notes: notes ?? null,
          }),
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
        return text ? JSON.parse(text) : null
      }
      if (!supabase) throw new Error('Supabase no configurado')
      const { data, error } = await supabase.rpc('create_action_claim', {
        p_action_type_id: actionTypeId,
        p_target_user_id: targetUserId,
        p_notes: notes ?? null,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action_claims'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useConfirmClaim() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (claimId: string) => {
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(`${h.url}/rest/v1/rpc/confirm_claim`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: h.key,
            Authorization: `Bearer ${h.token}`,
          },
          body: JSON.stringify({ p_claim_id: claimId }),
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
      const { error } = await supabase.rpc('confirm_claim', { p_claim_id: claimId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action_claims'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['balance_transactions'] })
      queryClient.invalidateQueries({ queryKey: ['weekly_collab_goal'] })
      queryClient.invalidateQueries({ queryKey: ['action_records'] })
      queryClient.invalidateQueries({ queryKey: ['historia_state'] })
    },
  })
}

export function useCancelClaim() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (claimId: string) => {
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(`${h.url}/rest/v1/rpc/cancel_claim`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: h.key,
            Authorization: `Bearer ${h.token}`,
          },
          body: JSON.stringify({ p_claim_id: claimId }),
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
      const { error } = await supabase.rpc('cancel_claim', { p_claim_id: claimId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action_claims'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
