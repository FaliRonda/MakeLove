import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, getRestHeaders } from '@/lib/supabase'
import type { ActionRequest } from '@/types'

const SELECT_REQUESTS =
  '*,action_types(id,name,points_value),requester:users!requester_id(id,name,email),target:users!target_user_id(id,name,email)'

async function expirePendingRequests(h: { url: string; key: string; token: string }): Promise<void> {
  const res = await fetch(`${h.url}/rest/v1/rpc/expire_pending_requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: h.key, Authorization: `Bearer ${h.token}` },
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error(`expire_pending_requests: ${res.status}`)
}

export function useActionRequests() {
  return useQuery({
    queryKey: ['action_requests'],
    queryFn: async () => {
      const h = getRestHeaders()
      if (h) {
        await expirePendingRequests(h)
        const res = await fetch(
          `${h.url}/rest/v1/action_requests?select=${encodeURIComponent(SELECT_REQUESTS)}&order=created_at.desc`,
          { headers: { apikey: h.key, Authorization: `Bearer ${h.token}` } }
        )
        if (!res.ok) return []
        const data = await res.json()
        return (Array.isArray(data) ? data : []) as ActionRequest[]
      }
      if (!supabase) return []
      await supabase.rpc('expire_pending_requests')
      const { data, error } = await supabase
        .from('action_requests')
        .select(`*,action_types(id,name,points_value),requester:users!requester_id(id,name,email),target:users!target_user_id(id,name,email)`)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ActionRequest[]
    },
  })
}

export function usePendingRequestsForUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['action_requests', 'pending', userId],
    queryFn: async () => {
      const h = getRestHeaders()
      if (h && userId) {
        await expirePendingRequests(h)
        const now = new Date().toISOString()
        const andFilter = `(or(requester_id.eq.${userId},target_user_id.eq.${userId}),or(and(status.eq.pending,expires_at.gt.${now}),status.eq.accepted_pending))`
        const q = new URLSearchParams({
          select: SELECT_REQUESTS,
          and: andFilter,
          order: 'created_at.desc',
        })
        const res = await fetch(`${h.url}/rest/v1/action_requests?${q}`, {
          headers: { apikey: h.key, Authorization: `Bearer ${h.token}` },
        })
        if (!res.ok) return []
        const data = await res.json()
        return (Array.isArray(data) ? data : []) as ActionRequest[]
      }
      if (!supabase || !userId) return []
      await supabase.rpc('expire_pending_requests')
      const nowIso = new Date().toISOString()
      const { data, error } = await supabase
        .from('action_requests')
        .select(`*,action_types(id,name,points_value),requester:users!requester_id(id,name,email),target:users!target_user_id(id,name,email)`)
        .or(`and(status.eq.pending,expires_at.gt.${nowIso}),status.eq.accepted_pending`)
        .or(`requester_id.eq.${userId},target_user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ActionRequest[]
    },
    enabled: !!userId,
  })
}


export function useCreateRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ targetUserId, actionTypeId }: { targetUserId: string; actionTypeId: string }) => {
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(`${h.url}/rest/v1/rpc/create_action_request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: h.key,
            Authorization: `Bearer ${h.token}`,
          },
          body: JSON.stringify({
            p_target_user_id: targetUserId,
            p_action_type_id: actionTypeId,
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
        try {
          return text ? JSON.parse(text) : null
        } catch {
          return null
        }
      }
      if (!supabase) throw new Error('Supabase no configurado')
      const { data, error } = await supabase.rpc('create_action_request', {
        p_target_user_id: targetUserId,
        p_action_type_id: actionTypeId,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action_requests'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useAcceptRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (requestId: string) => {
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(`${h.url}/rest/v1/rpc/accept_request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: h.key, Authorization: `Bearer ${h.token}` },
          body: JSON.stringify({ p_request_id: requestId }),
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
      const { error } = await supabase.rpc('accept_request', { p_request_id: requestId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action_requests'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useConfirmRequestCompletion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (requestId: string) => {
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(`${h.url}/rest/v1/rpc/confirm_request_completion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: h.key, Authorization: `Bearer ${h.token}` },
          body: JSON.stringify({ p_request_id: requestId }),
        })
        if (!res.ok) {
          const text = await res.text()
          let msg = `Error ${res.status}`
          try {
            const j = JSON.parse(text)
            if (j?.message) msg = j.message
          } catch {
            /* ignore */
          }
          throw new Error(msg)
        }
        return
      }
      if (!supabase) throw new Error('Supabase no configurado')
      const { error } = await supabase.rpc('confirm_request_completion', { p_request_id: requestId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action_requests'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['balance_transactions'] })
      queryClient.invalidateQueries({ queryKey: ['weekly_collab_goal'] })
      queryClient.invalidateQueries({ queryKey: ['action_records'] })
    },
  })
}

export function useRejectRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (requestId: string) => {
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(`${h.url}/rest/v1/rpc/reject_request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: h.key, Authorization: `Bearer ${h.token}` },
          body: JSON.stringify({ p_request_id: requestId }),
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
      const { error } = await supabase.rpc('reject_request', { p_request_id: requestId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action_requests'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['balance_transactions'] })
    },
  })
}

export function useCancelRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (requestId: string) => {
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(`${h.url}/rest/v1/rpc/cancel_request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: h.key, Authorization: `Bearer ${h.token}` },
          body: JSON.stringify({ p_request_id: requestId }),
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
      const { error } = await supabase.rpc('cancel_request', { p_request_id: requestId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action_requests'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['balance_transactions'] })
    },
  })
}

export function useRevertRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (requestId: string) => {
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(`${h.url}/rest/v1/rpc/revert_request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: h.key, Authorization: `Bearer ${h.token}` },
          body: JSON.stringify({ p_request_id: requestId }),
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
      const { error } = await supabase.rpc('revert_request', { p_request_id: requestId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action_requests'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['balance_transactions'] })
    },
  })
}
