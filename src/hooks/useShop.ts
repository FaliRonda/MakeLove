import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, getRestHeaders } from '@/lib/supabase'
import type { ShopItem, ShopItemType, UserInventoryItem } from '@/types'

type RestHeaders = { url: string; key: string; token: string }

type UserInventoryApiRow = {
  id: string
  user_id: string
  item_id: string
  acquired_at: string
  expires_at: string | null
  is_equipped: boolean
  shop_items?: ShopItem | null
}

function mapInventoryRow(row: UserInventoryApiRow): UserInventoryItem {
  const si = row.shop_items
  return {
    id: row.id,
    user_id: row.user_id,
    item_id: row.item_id,
    acquired_at: row.acquired_at,
    expires_at: row.expires_at,
    is_equipped: row.is_equipped,
    name: si?.name ?? 'Objeto de la tienda',
    description: si?.description ?? '',
    item_type: (si?.item_type ?? 'badge') as ShopItemType,
    color_value: si?.color_value ?? null,
    badge_symbol: si?.badge_symbol ?? null,
    is_temporary: si?.is_temporary ?? false,
    is_couple_item: si?.is_couple_item ?? false,
  }
}

function throwRestError(res: Response, text: string): never {
  let msg = `Error ${res.status}`
  try {
    const j = JSON.parse(text)
    if (j?.message) msg = j.message
    else if (j?.hint) msg = j.hint
  } catch { /* ignore */ }
  throw new Error(msg)
}

async function callRpc(h: RestHeaders, rpc: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${h.url}/rest/v1/rpc/${rpc}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: h.key,
      Authorization: `Bearer ${h.token}`,
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throwRestError(res, text)
  return text ? JSON.parse(text) : null
}

export function useShopItems() {
  return useQuery({
    queryKey: ['shop_items'],
    staleTime: 60_000,
    queryFn: async () => {
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(
          `${h.url}/rest/v1/shop_items?is_active=eq.true&order=sort_order.asc,created_at.asc`,
          { headers: { apikey: h.key, Authorization: `Bearer ${h.token}` } }
        )
        const text = await res.text()
        if (!res.ok) throwRestError(res, text)
        return text ? (JSON.parse(text) as ShopItem[]) : []
      }
      if (!supabase) return []
      const { data, error } = await supabase
        .from('shop_items')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return (data ?? []) as ShopItem[]
    },
  })
}

export function useUserInventory(userId: string | undefined) {
  return useQuery({
    queryKey: ['user_inventory', userId],
    enabled: !!userId,
    staleTime: 20_000,
    queryFn: async () => {
      if (!userId) return []
      const h = getRestHeaders()
      if (h) {
        const res = await fetch(
          `${h.url}/rest/v1/user_inventory?user_id=eq.${userId}&select=*,shop_items(*)`,
          { headers: { apikey: h.key, Authorization: `Bearer ${h.token}` } }
        )
        const text = await res.text()
        if (!res.ok) throwRestError(res, text)
        const raw = text
          ? (JSON.parse(text) as Array<
              UserInventoryItem & { shop_items: ShopItem | null }
            >)
          : []
        return raw.map((row) => mapInventoryRow(row as UserInventoryApiRow))
      }
      if (!supabase) return []
      const { data, error } = await supabase
        .from('user_inventory')
        .select('*, shop_items(*)')
        .eq('user_id', userId)
      if (error) throw error
      return (
        (data ?? []) as Array<UserInventoryItem & { shop_items: ShopItem | null }>
      ).map((row) => mapInventoryRow(row as UserInventoryApiRow))
    },
  })
}

export function useBuyShopItem(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string) => {
      if (!userId) throw new Error('No userId')
      const h = getRestHeaders()
      if (h) {
        return callRpc(h, 'buy_shop_item', { p_user_id: userId, p_item_id: itemId })
      }
      if (!supabase) throw new Error('Supabase no configurado')
      const { data, error } = await supabase.rpc('buy_shop_item', {
        p_user_id: userId,
        p_item_id: itemId,
      })
      if (error) throw error
      return data
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['user_inventory', userId] }),
        qc.invalidateQueries({ queryKey: ['profile'] }),
      ])
    },
  })
}

export function useEquipShopItem(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string) => {
      if (!userId) throw new Error('No userId')
      const h = getRestHeaders()
      if (h) {
        return callRpc(h, 'equip_shop_item', { p_user_id: userId, p_item_id: itemId })
      }
      if (!supabase) throw new Error('Supabase no configurado')
      const { data, error } = await supabase.rpc('equip_shop_item', {
        p_user_id: userId,
        p_item_id: itemId,
      })
      if (error) throw error
      return data
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['user_inventory', userId] }),
        qc.invalidateQueries({ queryKey: ['profile'] }),
        qc.invalidateQueries({ queryKey: ['users'] }),
      ])
    },
  })
}

export function useUnequipShopItemType(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (itemType: string) => {
      if (!userId) throw new Error('No userId')
      const h = getRestHeaders()
      if (h) {
        return callRpc(h, 'unequip_shop_item_type', {
          p_user_id: userId,
          p_item_type: itemType,
        })
      }
      if (!supabase) throw new Error('Supabase no configurado')
      const { data, error } = await supabase.rpc('unequip_shop_item_type', {
        p_user_id: userId,
        p_item_type: itemType,
      })
      if (error) throw error
      return data
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['user_inventory', userId] }),
        qc.invalidateQueries({ queryKey: ['profile'] }),
        qc.invalidateQueries({ queryKey: ['users'] }),
      ])
    },
  })
}
