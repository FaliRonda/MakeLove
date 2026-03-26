import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, getRestHeaders } from '@/lib/supabase'

// ---- Types ----

export type StoryStatus = 'planned' | 'active' | 'closed'
export type MissionTargetType = 'individual' | 'couple'
export type MissionMetricType =
  | 'actions_done'
  | 'requests_sent_confirmed'
  | 'requests_received_confirmed'
  | 'points_gained'
  | 'levels_gained'

export interface Story {
  id: string
  name: string
  description: string
  start_date: string
  end_date: string
  status: StoryStatus
  created_at: string
}

export interface Chapter {
  id: string
  story_id: string
  name: string
  order_number: number
  start_date: string
  end_date: string
  created_at: string
}

export interface MissionRequirement {
  id: string
  mission_id: string
  metric_type: MissionMetricType
  required_amount: number
}

export interface Mission {
  id: string
  chapter_id: string
  order_number: number
  title: string
  description: string
  target_type: MissionTargetType
  reward_piedritas: number
  created_at: string
  requirement?: MissionRequirement | null
}

// ---- REST helpers ----

function throwRestError(res: Response, text: string): never {
  let msg = `Error ${res.status}`
  try {
    const j = JSON.parse(text)
    if (j?.message) msg = j.message
    else if (j?.details) msg = j.details
  } catch { /* ignore */ }
  throw new Error(msg)
}

type RestHeaders = { url: string; key: string; token: string }

async function rGet<T>(h: RestHeaders, path: string): Promise<T[]> {
  const res = await fetch(`${h.url}/rest/v1/${path}`, {
    headers: { apikey: h.key, Authorization: `Bearer ${h.token}` },
  })
  const text = await res.text()
  if (!res.ok) throwRestError(res, text)
  return text ? (JSON.parse(text) as T[]) : []
}

async function rPost<T>(h: RestHeaders, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${h.url}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: h.key,
      Authorization: `Bearer ${h.token}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throwRestError(res, text)
  const parsed = text ? (JSON.parse(text) as unknown) : null
  return (Array.isArray(parsed) ? parsed[0] : parsed) as T
}

async function rPatch(h: RestHeaders, path: string, body: unknown): Promise<void> {
  const res = await fetch(`${h.url}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: h.key,
      Authorization: `Bearer ${h.token}`,
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throwRestError(res, text)
}

async function rDelete(h: RestHeaders, path: string): Promise<void> {
  const res = await fetch(`${h.url}/rest/v1/${path}`, {
    method: 'DELETE',
    headers: { apikey: h.key, Authorization: `Bearer ${h.token}` },
  })
  const text = await res.text()
  if (!res.ok) throwRestError(res, text)
}

// ---- Queries ----

export function useStoriesList() {
  return useQuery({
    queryKey: ['admin_stories'],
    queryFn: async () => {
      const h = getRestHeaders()
      if (h) return rGet<Story>(h, 'stories?order=start_date.asc')
      if (!supabase) return []
      const { data, error } = await supabase.from('stories').select('*').order('start_date')
      if (error) throw error
      return (data ?? []) as Story[]
    },
  })
}

export function useChaptersByStory(storyId: string | null) {
  return useQuery({
    queryKey: ['admin_chapters', storyId],
    enabled: !!storyId,
    queryFn: async () => {
      if (!storyId) return []
      const h = getRestHeaders()
      if (h) {
        return rGet<Chapter>(h, `chapters?story_id=eq.${storyId}&order=order_number.asc`)
      }
      if (!supabase) return []
      const { data, error } = await supabase
        .from('chapters')
        .select('*')
        .eq('story_id', storyId)
        .order('order_number')
      if (error) throw error
      return (data ?? []) as Chapter[]
    },
  })
}

export function useMissionsByChapter(chapterId: string | null) {
  return useQuery({
    queryKey: ['admin_missions', chapterId],
    enabled: !!chapterId,
    queryFn: async () => {
      if (!chapterId) return []
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(
          `${h.url}/rest/v1/missions?chapter_id=eq.${chapterId}&order=order_number.asc&select=*,mission_requirements(*)`,
          { headers: { apikey: h.key, Authorization: `Bearer ${h.token}` } }
        )
        const text = await res.text()
        if (!res.ok) throwRestError(res, text)
        const data = text
          ? (JSON.parse(text) as Array<Omit<Mission, 'requirement'> & { mission_requirements: MissionRequirement[] }>)
          : []
        return data.map((m) => ({ ...m, requirement: m.mission_requirements?.[0] ?? null })) as Mission[]
      }
      if (!supabase) return []
      const { data, error } = await supabase
        .from('missions')
        .select('*, mission_requirements(*)')
        .eq('chapter_id', chapterId)
        .order('order_number')
      if (error) throw error
      return (
        (data ?? []) as Array<Omit<Mission, 'requirement'> & { mission_requirements: MissionRequirement[] }>
      ).map((m) => ({ ...m, requirement: m.mission_requirements?.[0] ?? null })) as Mission[]
    },
  })
}

// ---- Story mutations ----

export function useCreateStory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Omit<Story, 'id' | 'created_at'>) => {
      const h = getRestHeaders()
      if (h) return rPost<Story>(h, 'stories', data)
      if (!supabase) throw new Error('No supabase')
      const { data: r, error } = await supabase.from('stories').insert(data).select().single()
      if (error) throw error
      return r as Story
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin_stories'] }),
  })
}

export function useUpdateStory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Omit<Story, 'created_at'>> & { id: string }) => {
      const h = getRestHeaders()
      if (h) return rPatch(h, `stories?id=eq.${id}`, data)
      if (!supabase) throw new Error('No supabase')
      const { error } = await supabase.from('stories').update(data).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin_stories'] }),
  })
}

export function useDeleteStory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const h = getRestHeaders()
      if (h) return rDelete(h, `stories?id=eq.${id}`)
      if (!supabase) throw new Error('No supabase')
      const { error } = await supabase.from('stories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin_stories'] }),
  })
}

// ---- Chapter mutations ----

export function useCreateChapter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Omit<Chapter, 'id' | 'created_at'>) => {
      const h = getRestHeaders()
      if (h) return rPost<Chapter>(h, 'chapters', data)
      if (!supabase) throw new Error('No supabase')
      const { data: r, error } = await supabase.from('chapters').insert(data).select().single()
      if (error) throw error
      return r as Chapter
    },
    onSuccess: (_r, vars) => qc.invalidateQueries({ queryKey: ['admin_chapters', vars.story_id] }),
  })
}

export function useUpdateChapter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      story_id,
      ...data
    }: Partial<Omit<Chapter, 'created_at'>> & { id: string; story_id: string }) => {
      const h = getRestHeaders()
      if (h) return rPatch(h, `chapters?id=eq.${id}`, data)
      if (!supabase) throw new Error('No supabase')
      const { error } = await supabase.from('chapters').update(data).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_r, vars) => qc.invalidateQueries({ queryKey: ['admin_chapters', vars.story_id] }),
  })
}

export function useDeleteChapter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, story_id: _sid }: { id: string; story_id: string }) => {
      const h = getRestHeaders()
      if (h) return rDelete(h, `chapters?id=eq.${id}`)
      if (!supabase) throw new Error('No supabase')
      const { error } = await supabase.from('chapters').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_r, vars) => qc.invalidateQueries({ queryKey: ['admin_chapters', vars.story_id] }),
  })
}

// ---- Mission mutations ----

type CreateMissionInput = Omit<Mission, 'id' | 'created_at' | 'requirement'> & {
  requirement?: { metric_type: MissionMetricType; required_amount: number }
}

export function useCreateMission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ requirement, ...missionData }: CreateMissionInput) => {
      const h = getRestHeaders()
      let missionId: string
      if (h) {
        const created = await rPost<Mission>(h, 'missions', missionData)
        missionId = created.id
      } else {
        if (!supabase) throw new Error('No supabase')
        const { data: r, error } = await supabase.from('missions').insert(missionData).select().single()
        if (error) throw error
        missionId = (r as Mission).id
      }
      if (requirement) {
        const reqData = { mission_id: missionId, ...requirement }
        if (h) {
          await rPost<MissionRequirement>(h, 'mission_requirements', reqData)
        } else {
          if (!supabase) throw new Error('No supabase')
          const { error } = await supabase.from('mission_requirements').insert(reqData)
          if (error) throw error
        }
      }
    },
    onSuccess: (_r, vars) => qc.invalidateQueries({ queryKey: ['admin_missions', vars.chapter_id] }),
  })
}

type UpdateMissionInput = Partial<Omit<Mission, 'created_at' | 'requirement'>> & {
  id: string
  chapter_id: string
  requirement?: { metric_type: MissionMetricType; required_amount: number } | null
}

export function useUpdateMission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, chapter_id: _chId, requirement, ...data }: UpdateMissionInput) => {
      const h = getRestHeaders()
      const missionFields = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
      if (Object.keys(missionFields).length > 0) {
        if (h) await rPatch(h, `missions?id=eq.${id}`, missionFields)
        else {
          if (!supabase) throw new Error('No supabase')
          const { error } = await supabase.from('missions').update(missionFields).eq('id', id)
          if (error) throw error
        }
      }
      if (requirement !== undefined) {
        if (h) {
          await rDelete(h, `mission_requirements?mission_id=eq.${id}`)
          if (requirement) {
            await rPost<MissionRequirement>(h, 'mission_requirements', {
              mission_id: id,
              metric_type: requirement.metric_type,
              required_amount: requirement.required_amount,
            })
          }
        } else {
          if (!supabase) throw new Error('No supabase')
          await supabase.from('mission_requirements').delete().eq('mission_id', id)
          if (requirement) {
            await supabase.from('mission_requirements').insert({
              mission_id: id,
              metric_type: requirement.metric_type,
              required_amount: requirement.required_amount,
            })
          }
        }
      }
    },
    onSuccess: (_r, vars) => qc.invalidateQueries({ queryKey: ['admin_missions', vars.chapter_id] }),
  })
}

export function useDeleteMission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, chapter_id: _chId }: { id: string; chapter_id: string }) => {
      const h = getRestHeaders()
      if (h) return rDelete(h, `missions?id=eq.${id}`)
      if (!supabase) throw new Error('No supabase')
      const { error } = await supabase.from('missions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_r, vars) => qc.invalidateQueries({ queryKey: ['admin_missions', vars.chapter_id] }),
  })
}
