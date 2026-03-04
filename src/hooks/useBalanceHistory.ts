import { useQuery } from '@tanstack/react-query'
import { supabase, getRestHeaders } from '@/lib/supabase'
import type { BalanceTransaction } from '@/types'

export function useBalanceHistory(userId: string | undefined) {
  return useQuery({
    queryKey: ['balance_transactions', userId],
    queryFn: async () => {
      const h = getRestHeaders()
      if (h && userId) {
        const res = await fetch(
          `${h.url}/rest/v1/balance_transactions?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=100`,
          {
            headers: { apikey: h.key, Authorization: `Bearer ${h.token}` },
          }
        )
        if (!res.ok) return []
        const data = await res.json()
        return (Array.isArray(data) ? data : []) as BalanceTransaction[]
      }
      if (!supabase || !userId) return []
      const { data, error } = await supabase
        .from('balance_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []) as BalanceTransaction[]
    },
    enabled: !!userId,
  })
}
