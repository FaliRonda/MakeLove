import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, getRestHeaders } from '@/lib/supabase'
import type { ActionType } from '@/types'

function throwRestError(res: Response, text: string): never {
  let msg = `Error ${res.status}`
  try {
    const j = JSON.parse(text)
    if (j?.message) msg = j.message
  } catch { /* ignore */ }
  throw new Error(msg)
}

export function useCreateActionType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Omit<ActionType, 'id' | 'created_at'>) => {
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(`${h.url}/rest/v1/action_types`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: h.key,
            Authorization: `Bearer ${h.token}`,
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            name: data.name,
            description: data.description ?? '',
            points_value: data.points_value,
            reward_percentage: data.reward_percentage ?? null,
            is_active: data.is_active ?? true,
          }),
        })
        const text = await res.text()
        if (!res.ok) throwRestError(res, text)
        const parsed = text ? JSON.parse(text) : null
        return Array.isArray(parsed) ? parsed[0] : parsed
      }
      if (!supabase) throw new Error('Supabase no configurado')
      const { data: result, error } = await supabase
        .from('action_types')
        .insert({
          name: data.name,
          description: data.description ?? '',
          points_value: data.points_value,
          reward_percentage: data.reward_percentage ?? null,
          is_active: data.is_active ?? true,
        })
        .select()
        .single()
      if (error) throw new Error(error.message || 'Error al crear la acción')
      return result
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['action_types'] }),
  })
}

export function useUpdateActionType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ActionType> & { id: string }) => {
      const h = getRestHeaders()
      const body: Record<string, unknown> = {}
      if (data.name !== undefined) body.name = data.name
      if (data.description !== undefined) body.description = data.description
      if (data.points_value !== undefined) body.points_value = data.points_value
      if (data.reward_percentage !== undefined) body.reward_percentage = data.reward_percentage
      if (data.is_active !== undefined) body.is_active = data.is_active
      if (h && Object.keys(body).length > 0) {
        const res = await fetch(`${h.url}/rest/v1/action_types?id=eq.${encodeURIComponent(id)}`, {
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
        return
      }
      if (!supabase) throw new Error('Supabase no configurado')
      const { error } = await supabase
        .from('action_types')
        .update({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.points_value !== undefined && { points_value: data.points_value }),
          ...(data.reward_percentage !== undefined && { reward_percentage: data.reward_percentage }),
          ...(data.is_active !== undefined && { is_active: data.is_active }),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['action_types'] }),
  })
}

export function useDeleteActionType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(`${h.url}/rest/v1/action_types?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { apikey: h.key, Authorization: `Bearer ${h.token}` },
        })
        const text = await res.text()
        if (!res.ok) throwRestError(res, text)
        return
      }
      if (!supabase) throw new Error('Supabase no configurado')
      const { error } = await supabase.from('action_types').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['action_types'] }),
  })
}
