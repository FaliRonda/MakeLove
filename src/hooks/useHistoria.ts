import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, getRestHeaders } from '@/lib/supabase'

export type HistoriaProgress = {
  is_complete: boolean
  progress_value: number
  progress_target: number
}

export type HistoriaMissionRequirement = {
  metric_type: string
  required_amount: number
}

export type HistoriaMission = {
  id: string
  order_number: number
  title: string
  description: string
  target_type: 'individual' | 'couple'
  reward_piedritas: number
  claimed: boolean
  /** Presente cuando el backend expone mission_requirements (migración 032+). */
  requirements?: HistoriaMissionRequirement[]
  progress: HistoriaProgress | null
}

export type HistoriaChapter = {
  id: string
  name: string
  order_number: number
  start_date: string
  end_date: string
  missions: HistoriaMission[]
}

export type HistoriaState = {
  as_of: string
  user_id: string
  partner_user_id: string | null
  story: null | {
    id: string
    name: string
    description: string
    start_date: string
    end_date: string
  }
  chapters: HistoriaChapter[]
}

function parseHistoriaState(data: unknown): HistoriaState | null {
  if (!data) return null
  return data as HistoriaState
}

export function useActiveHistoriaState(userId: string | undefined) {
  return useQuery({
    queryKey: ['historia_state', userId],
    enabled: !!userId,
    staleTime: 20_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!userId) return null
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(`${h.url}/rest/v1/rpc/get_active_story_state`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: h.key,
            Authorization: `Bearer ${h.token}`,
          },
          body: JSON.stringify({ p_user_id: userId }),
        })
        if (!res.ok) throw new Error(`get_active_story_state: ${res.status}`)
        const text = await res.text()
        const json = text ? JSON.parse(text) : null
        const normalized = Array.isArray(json) ? json[0] : json
        return parseHistoriaState(normalized)
      }
      if (!supabase) return null
      const { data, error } = await supabase.rpc('get_active_story_state', { p_user_id: userId })
      if (error) throw error
      return parseHistoriaState(data)
    },
  })
}

export function useClaimHistoriaMissionReward(userId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (missionId: string) => {
      if (!userId) throw new Error('No userId')
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(`${h.url}/rest/v1/rpc/claim_story_mission_reward`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: h.key,
            Authorization: `Bearer ${h.token}`,
          },
          body: JSON.stringify({ p_user_id: userId, p_mission_id: missionId }),
        })
        if (!res.ok) {
          const text = await res.text()
          let msg = `claim_story_mission_reward: ${res.status}`
          try {
            const j = JSON.parse(text)
            if (j?.message) msg = j.message
          } catch {
            /* ignore */
          }
          throw new Error(msg)
        }
        const text = await res.text()
        const parsed = text ? JSON.parse(text) : null
        if (Array.isArray(parsed)) return parsed[0] as number
        return parsed as number
      }
      if (!supabase) throw new Error('Supabase no configurado')
      const { data, error } = await supabase.rpc('claim_story_mission_reward', {
        p_user_id: userId,
        p_mission_id: missionId,
      })
      if (error) throw error
      return data as number
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['historia_state', userId] }),
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
      ])
    },
  })
}

