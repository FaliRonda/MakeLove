import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, getRestHeaders } from '@/lib/supabase'
import type { UserLevelMedal } from '@/types'

async function fetchLevelMedals(userId: string): Promise<UserLevelMedal[]> {
  const h = getRestHeaders()
  if (h) {
    const res = await fetch(
      `${h.url}/rest/v1/user_level_medals?user_id=eq.${encodeURIComponent(userId)}&order=level.asc`,
      { headers: { apikey: h.key, Authorization: `Bearer ${h.token}` } }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (Array.isArray(data) ? data : []) as UserLevelMedal[]
  }
  if (!supabase) return []
  const { data, error } = await supabase
    .from('user_level_medals')
    .select('*')
    .eq('user_id', userId)
    .order('level', { ascending: true })
  if (error) throw error
  return (data ?? []) as UserLevelMedal[]
}

export function useLevelMedals(userId: string | undefined) {
  return useQuery({
    queryKey: ['level_medals', userId],
    queryFn: () => fetchLevelMedals(userId!),
    enabled: !!userId,
  })
}

export function useRedeemLevelMedal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      userId,
      level,
      note,
    }: {
      userId: string
      level: number
      note: string | null
    }) => {
      const h = getRestHeaders()
      const body = {
        user_id: userId,
        level,
        redeemed_at: new Date().toISOString(),
        note: note?.trim() ? note.trim() : null,
      }
      if (h) {
        const res = await fetch(`${h.url}/rest/v1/user_level_medals`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: h.key,
            Authorization: `Bearer ${h.token}`,
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify(body),
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
      const { error } = await supabase.from('user_level_medals').upsert(body, {
        onConflict: 'user_id,level',
      })
      if (error) throw error
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['level_medals', userId] })
    },
  })
}
