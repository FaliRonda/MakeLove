import type { ShopItem, UserInventoryItem } from '@/types'

/** Construye un `ShopItem` mínimo para tarjetas / modal a partir del inventario. */
export function userInventoryToShopItem(row: UserInventoryItem): ShopItem {
  return {
    id: row.item_id,
    name: row.name,
    description: row.description,
    item_type: row.item_type,
    color_value: row.color_value,
    badge_symbol: row.badge_symbol,
    frame_overlay_url: row.frame_overlay_url ?? null,
    cost_piedritas: 0,
    /** La ventana de tienda (is_temporary / available_until) no aplica al objeto ya comprado. */
    is_temporary: false,
    available_until: null,
    is_couple_item: row.is_couple_item,
    is_purchasable: false,
    is_active: true,
    sort_order: 0,
    created_at: row.acquired_at,
  }
}
