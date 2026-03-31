import type { ShopItem, UserInventoryItem } from '@/types'

export function ShopItemCard({
  item,
  inventoryItem,
  onClick,
}: {
  item: ShopItem
  inventoryItem?: UserInventoryItem
  onClick: () => void
}) {
  const owned = !!inventoryItem
  const equipped = inventoryItem?.is_equipped ?? false
  const expired = inventoryItem?.expires_at ? new Date(inventoryItem.expires_at) < new Date() : false

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col items-center gap-2 p-4 rounded-2xl border border-app-border bg-app-surface hover:border-app-border-hover hover:shadow-md transition-all text-center w-full"
    >
      {item.is_couple_item && (
        <span className="absolute top-2 right-2 text-xs bg-pink-500/20 text-pink-400 border border-pink-500/30 px-1.5 py-0.5 rounded-full">
          💑 pareja
        </span>
      )}
      {equipped && (
        <span className="absolute top-2 left-2 text-xs bg-app-accent/20 text-app-accent border border-app-accent/30 px-1.5 py-0.5 rounded-full">
          equipado
        </span>
      )}

      {item.item_type === 'name_color' && item.color_value ? (
        <div
          className="w-12 h-12 rounded-full shadow-md"
          style={{
            background: `radial-gradient(circle at 35% 35%, white 0%, ${item.color_value} 70%)`,
          }}
        />
      ) : (
        <span className="text-4xl select-none">{item.badge_symbol ?? '🏅'}</span>
      )}

      <p className="text-sm font-semibold text-app-foreground leading-snug">{item.name}</p>

      {owned ? (
        <span className="text-xs text-green-400">{expired ? 'Expirado' : 'Tuyo'}</span>
      ) : (
        <span className="text-xs font-bold text-app-accent tabular-nums">{item.cost_piedritas} 💎</span>
      )}
    </button>
  )
}
