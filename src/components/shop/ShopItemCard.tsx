import type { ShopItem, UserInventoryItem } from '@/types'
import type { FramePreviewUser } from '@/components/shop/ShopItemDetailModal'
import { resolveFrameOverlayUrl } from '@/lib/resolveFrameOverlayUrl'
import { Avatar } from '@/components/Avatar'

export function ShopItemCard({
  item,
  inventoryItem,
  onClick,
  framePreviewUser,
}: {
  item: ShopItem
  inventoryItem?: UserInventoryItem
  onClick: () => void
  /** Misma preview que en el modal: marco sobre tu foto. */
  framePreviewUser?: FramePreviewUser | null
}) {
  const owned = !!inventoryItem
  const equipped = inventoryItem?.is_equipped ?? false
  const expired = inventoryItem?.expires_at ? new Date(inventoryItem.expires_at) < new Date() : false
  const frameSrc = resolveFrameOverlayUrl(item.frame_overlay_url)

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
      ) : item.item_type === 'avatar_frame' ? (
        frameSrc ? (
          <span className="inline-flex rounded-xl bg-app-muted/25 px-2 py-2 ring-1 ring-app-border/45">
            <Avatar
              avatarUrl={framePreviewUser?.avatarUrl ?? null}
              name={framePreviewUser?.name ?? '?'}
              size="md"
              frameOverlayUrl={item.frame_overlay_url}
              className="shrink-0"
            />
          </span>
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-app-muted/30 text-2xl select-none">
            {item.badge_symbol ?? '🎭'}
          </div>
        )
      ) : (
        <span className="text-4xl select-none">{item.badge_symbol ?? '🏅'}</span>
      )}

      <p className="text-sm font-semibold text-app-foreground leading-snug">{item.name}</p>

      {owned ? (
        <span className="text-xs text-green-400">{expired ? 'Expirado' : 'Tuyo'}</span>
      ) : item.is_purchasable === false ? (
        <span className="text-[10px] sm:text-xs font-semibold text-amber-400/95 leading-snug px-0.5">
          Historia: Cuatro atardeceres en Roma
        </span>
      ) : (
        <span className="text-xs font-bold text-app-accent tabular-nums">{item.cost_piedritas} 💎</span>
      )}
    </button>
  )
}
