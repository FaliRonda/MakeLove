import type { ShopItemType } from '@/types'

export const SHOP_TYPE_LABELS: Record<ShopItemType, string> = {
  name_color: '🎨 Colores de nombre',
  badge: '✦ Insignias',
  medal: '🏅 Medallas',
}

export const SHOP_TYPE_ORDER: ShopItemType[] = ['name_color', 'badge', 'medal']
