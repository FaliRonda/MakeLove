import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, getRestHeaders } from '@/lib/supabase'

export function useAdminSetCouple() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userAId, userBId }: { userAId: string; userBId: string }) => {
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(`${h.url}/rest/v1/rpc/admin_set_couple`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: h.key,
            Authorization: `Bearer ${h.token}`,
          },
          body: JSON.stringify({ p_user_a_id: userAId, p_user_b_id: userBId }),
        })
        if (!res.ok) throw new Error(`admin_set_couple: ${res.status}`)
        const text = await res.text()
        const json = text ? JSON.parse(text) : null
        if (Array.isArray(json)) return json[0] as string
        if (typeof json === 'string') return json
        return (json?.id ?? json) as string
      }
      if (!supabase) throw new Error('Supabase no configurado')
      const { data, error } = await supabase.rpc('admin_set_couple', {
        p_user_a_id: userAId,
        p_user_b_id: userBId,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: async () => {
      // La app no tiene todavía caché específica de parejas; limpiamos cosas relevantes
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
      ])
    },
  })
}

