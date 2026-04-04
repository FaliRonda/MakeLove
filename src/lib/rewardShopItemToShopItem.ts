import type { HistoriaMissionRewardShopItem } from '@/hooks/useHistoria'
import type { ShopItem, ShopItemType } from '@/types'

/** Construye un `ShopItem` coherente con la tienda a partir del embed de Historia (p. ej. abrir detalle). */
export function rewardShopItemToShopItem(r: HistoriaMissionRewardShopItem): ShopItem {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    item_type: r.item_type as ShopItemType,
    color_value: null,
    badge_symbol: r.badge_symbol,
    frame_overlay_url: r.frame_overlay_url ?? null,
    cost_piedritas: 0,
    is_temporary: false,
    available_until: null,
    is_couple_item: false,
    is_purchasable: false,
    is_active: true,
    sort_order: 0,
    created_at: new Date(0).toISOString(),
  }
}
