import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, getRestHeaders } from '@/lib/supabase'
import type { Notification } from '@/types'

export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      const h = getRestHeaders()
      if (h && userId) {
        const q = new URLSearchParams({
          select: '*',
          user_id: `eq.${userId}`,
          order: 'created_at.desc',
          limit: '50',
        })
        const res = await fetch(`${h.url}/rest/v1/notifications?${q}`, {
          headers: { apikey: h.key, Authorization: `Bearer ${h.token}` },
        })
        if (!res.ok) return []
        const data = await res.json()
        return (Array.isArray(data) ? data : []) as Notification[]
      }
      if (!supabase || !userId) return []
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as Notification[]
    },
    enabled: !!userId,
  })
}

export function useUnreadCount(userId: string | undefined) {
  return useQuery({
    queryKey: ['notifications', 'unread', userId],
    queryFn: async () => {
      const h = getRestHeaders()
      if (h && userId) {
        const res = await fetch(
          `${h.url}/rest/v1/notifications?user_id=eq.${encodeURIComponent(userId)}&read=eq.false&select=id`,
          {
            headers: {
              apikey: h.key,
              Authorization: `Bearer ${h.token}`,
              Prefer: 'count=exact',
            },
          }
        )
        const range = res.headers.get('Content-Range')
        if (range) {
          const m = /^\d+-\d+\/(\d+)$/.exec(range) || /^(\d+)$/.exec(range)
          if (m) return parseInt(m[1], 10) || 0
        }
        if (!res.ok) return 0
        const data = await res.json()
        return Array.isArray(data) ? data.length : 0
      }
      if (!supabase || !userId) return 0
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!userId,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(`${h.url}/rest/v1/notifications?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: h.key,
            Authorization: `Bearer ${h.token}`,
          },
          body: JSON.stringify({ read: true }),
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
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
