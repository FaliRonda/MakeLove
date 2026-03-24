import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, getRestHeaders } from '@/lib/supabase'
import type { WeeklyCollabGoalState } from '@/types'

function parseState(data: unknown): WeeklyCollabGoalState {
  const o = data as Record<string, unknown>
  return {
    week_monday: String(o.week_monday ?? ''),
    action_count: Number(o.action_count ?? 0),
    goal: Number(o.goal ?? 4),
    reward_points: Number(o.reward_points ?? 20),
    claimed: Boolean(o.claimed),
    can_claim: Boolean(o.can_claim),
  }
}

async function fetchWeeklyCollabGoalState(): Promise<WeeklyCollabGoalState | null> {
  const h = getRestHeaders()
  if (h) {
    const res = await fetch(`${h.url}/rest/v1/rpc/get_weekly_collab_goal_state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: h.key,
        Authorization: `Bearer ${h.token}`,
      },
      body: JSON.stringify({}),
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
    const data = await res.json()
    return parseState(data)
  }
  if (!supabase) throw new Error('Supabase no configurado')
  const { data, error } = await supabase.rpc('get_weekly_collab_goal_state')
  if (error) throw error
  return parseState(data)
}

export function useWeeklyCollabGoal(enabled: boolean) {
  return useQuery({
    queryKey: ['weekly_collab_goal'],
    queryFn: fetchWeeklyCollabGoalState,
    enabled,
    staleTime: 20_000,
  })
}

export function useClaimWeeklyCollabReward() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(`${h.url}/rest/v1/rpc/claim_weekly_collab_reward`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: h.key,
            Authorization: `Bearer ${h.token}`,
          },
          body: JSON.stringify({}),
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
      const { error } = await supabase.rpc('claim_weekly_collab_reward')
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly_collab_goal'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['balance_transactions'] })
    },
  })
}
