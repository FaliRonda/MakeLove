import type { HistoriaMissionRewardShopItem } from '@/hooks/useHistoria'
import { resolveFrameOverlayUrl } from '@/lib/resolveFrameOverlayUrl'
import { Avatar } from '@/components/Avatar'

type Props = {
  reward: HistoriaMissionRewardShopItem
  onOpenDetail: (reward: HistoriaMissionRewardShopItem) => void
  extraPiedritas?: number
}

/** Texto + miniatura a la derecha; todo el bloque abre el detalle del ítem de tienda. */
export function MissionRewardShopPreview({ reward, onOpenDetail, extraPiedritas }: Props) {
  const label = (
    <>
      Recompensa:{' '}
      {reward.badge_symbol ? `${reward.badge_symbol} ` : null}
      <span className="text-app-foreground">{reward.name}</span>
      {extraPiedritas != null && extraPiedritas > 0 ? (
        <span className="mt-0.5 block tabular-nums text-app-accent">+{extraPiedritas} 💎</span>
      ) : null}
    </>
  )

  return (
    <button
      type="button"
      onClick={() => onOpenDetail(reward)}
      aria-label={`Ver detalle de la recompensa: ${reward.name}`}
      className="group flex max-w-[min(100%,18rem)] items-center gap-2 rounded-xl border border-transparent px-1.5 py-1 text-left transition hover:border-amber-500/35 hover:bg-amber-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
    >
      <span className="min-w-0 flex-1 text-xs font-semibold leading-snug text-amber-400/95">{label}</span>
      <MissionRewardThumb reward={reward} />
    </button>
  )
}

function MissionRewardThumb({ reward }: { reward: HistoriaMissionRewardShopItem }) {
  const frameSrc = resolveFrameOverlayUrl(reward.frame_overlay_url)
  if (reward.item_type === 'avatar_frame' && frameSrc) {
    return (
      <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-visible rounded-xl border border-app-border bg-app-muted/20 group-hover:border-amber-500/45">
        <Avatar
          avatarUrl={null}
          name="?"
          size="md"
          frameOverlayUrl={reward.frame_overlay_url}
          className="shrink-0"
        />
      </span>
    )
  }
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-app-border bg-violet-950/30 text-3xl leading-none shadow-inner group-hover:border-amber-500/45">
      {reward.badge_symbol ?? '🏅'}
    </span>
  )
}
