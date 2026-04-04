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
  prior_mission_ids?: string[] | null
}

export type HistoriaMissionRewardShopItem = {
  id: string
  name: string
  description?: string
  item_type: string
  badge_symbol: string | null
  frame_overlay_url: string | null
}

export type HistoriaMission = {
  id: string
  order_number: number
  title: string
  description: string
  target_type: 'individual' | 'couple'
  reward_piedritas: number
  reward_shop_item?: HistoriaMissionRewardShopItem | null
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

export type StoryMissionClaimResult = {
  piedritas: number
  shop_item: HistoriaMissionRewardShopItem | null
}

function parseClaimStoryMissionReward(raw: unknown): StoryMissionClaimResult {
  if (raw != null && typeof raw === 'object' && 'piedritas' in raw) {
    const o = raw as Record<string, unknown>
    const si = o.shop_item
    const shopItem =
      si != null && typeof si === 'object'
        ? ({
            id: String((si as Record<string, unknown>).id ?? ''),
            name: String((si as Record<string, unknown>).name ?? ''),
            item_type: String((si as Record<string, unknown>).item_type ?? ''),
            badge_symbol: ((si as Record<string, unknown>).badge_symbol as string | null) ?? null,
            frame_overlay_url: ((si as Record<string, unknown>).frame_overlay_url as string | null) ?? null,
          } as HistoriaMissionRewardShopItem)
        : null
    return {
      piedritas: typeof o.piedritas === 'number' ? o.piedritas : 0,
      shop_item: shopItem?.id ? shopItem : null,
    }
  }
  if (typeof raw === 'number') {
    return { piedritas: raw, shop_item: null }
  }
  return { piedritas: 0, shop_item: null }
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
        const payload = Array.isArray(parsed) ? parsed[0] : parsed
        return parseClaimStoryMissionReward(payload)
      }
      if (!supabase) throw new Error('Supabase no configurado')
      const { data, error } = await supabase.rpc('claim_story_mission_reward', {
        p_user_id: userId,
        p_mission_id: missionId,
      })
      if (error) throw error
      return parseClaimStoryMissionReward(data)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['historia_state', userId] }),
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: ['user_inventory', userId] }),
      ])
    },
  })
}

