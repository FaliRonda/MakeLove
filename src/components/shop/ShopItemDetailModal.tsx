import { useQueryClient } from '@tanstack/react-query'
import { useBuyShopItem, useEquipShopItem, useUnequipShopItemType } from '@/hooks/useShop'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/Avatar'
import { formatDate } from '@/lib/utils'
import { resolveFrameOverlayUrl } from '@/lib/resolveFrameOverlayUrl'
import type { ShopItem, UserInventoryItem } from '@/types'

/** Foto + nombre para previsualizar un marco como se verá en el perfil. */
export type FramePreviewUser = {
  avatarUrl: string | null
  name: string
}

export function ItemAnimation({
  item,
  framePreviewUser,
}: {
  item: ShopItem
  framePreviewUser?: FramePreviewUser | null
}) {
  const previewName = framePreviewUser?.name?.trim() || ''
  const nameColorLabel = previewName !== '' ? previewName : 'Tu nombre aquí'
  const nameWithFallback = previewName !== '' ? previewName : 'Tu nombre'

  if (item.item_type === 'name_color' && item.color_value) {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <style>{`
          @keyframes colorPulse {
            0%,100% { text-shadow: 0 0 12px ${item.color_value}88, 0 0 28px ${item.color_value}44; opacity:1; }
            50%      { text-shadow: 0 0 28px ${item.color_value}cc, 0 0 56px ${item.color_value}66; opacity:0.85; }
          }
          @keyframes swatchSpin {
            from { transform: rotate(0deg) scale(1); }
            50%  { transform: rotate(180deg) scale(1.12); }
            to   { transform: rotate(360deg) scale(1); }
          }
        `}</style>
        <div
          className="w-20 h-20 rounded-full shadow-2xl"
          style={{
            background: `radial-gradient(circle at 35% 35%, white 0%, ${item.color_value} 60%)`,
            animation: 'swatchSpin 3s ease-in-out infinite',
          }}
        />
        <p
          className="text-2xl font-bold tracking-wide text-center max-w-[18rem] truncate px-1"
          style={{
            color: item.color_value,
            animation: 'colorPulse 2s ease-in-out infinite',
          }}
          title={nameColorLabel}
        >
          {nameColorLabel}
        </p>
      </div>
    )
  }

  if (item.item_type === 'avatar_frame') {
    const frameSrc = resolveFrameOverlayUrl(item.frame_overlay_url)
    return (
      <div className="flex flex-col items-center gap-4 pb-6 pt-1">
        <style>{`
          @keyframes maskFloat {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-4px) scale(1.02); }
          }
        `}</style>
        <div
          className="flex w-full max-w-[16.5rem] items-center justify-center overflow-visible rounded-3xl bg-gradient-to-br from-amber-950/55 via-amber-900/45 to-app-bg border border-amber-700/35 px-3 pt-8 pb-6 sm:px-4"
          style={{ animation: 'maskFloat 3s ease-in-out infinite' }}
        >
          {frameSrc ? (
            <Avatar
              avatarUrl={framePreviewUser?.avatarUrl ?? null}
              name={framePreviewUser?.name ?? '?'}
              size="xl"
              frameOverlayUrl={item.frame_overlay_url}
              className="shrink-0 drop-shadow-xl"
            />
          ) : (
            <span className="text-6xl select-none">{item.badge_symbol ?? '🎭'}</span>
          )}
        </div>
        <p className="text-sm text-app-muted text-center px-2">
          Marco sobre tu foto: estilo máscara veneciana con adornos que rodean el círculo del avatar.
        </p>
      </div>
    )
  }

  if (item.item_type === 'badge' && item.badge_symbol) {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <style>{`
          @keyframes badgeBounce {
            0%,100% { transform: translateY(0) rotate(-5deg) scale(1); }
            30%      { transform: translateY(-18px) rotate(8deg) scale(1.18); }
            60%      { transform: translateY(-8px) rotate(-3deg) scale(1.08); }
          }
          @keyframes sparkle {
            0%,100% { opacity:0; transform:scale(0.5); }
            50%      { opacity:1; transform:scale(1.2); }
          }
        `}</style>
        <div className="relative flex items-center justify-center h-28 w-28">
          <span
            className="text-7xl select-none"
            style={{ animation: 'badgeBounce 1.8s ease-in-out infinite' }}
          >
            {item.badge_symbol}
          </span>
          {['top-0 left-2', 'top-2 right-0', 'bottom-0 left-6', 'bottom-2 right-2'].map((pos, i) => (
            <span
              key={i}
              className={`absolute ${pos} text-yellow-300 text-xl select-none`}
              style={{ animation: `sparkle 1.5s ease-in-out ${i * 0.35}s infinite` }}
            >
              ✦
            </span>
          ))}
        </div>
        <p className="text-base text-app-muted">
          Aparece junto a tu nombre:{' '}
          <span className="text-app-foreground font-semibold">
            {nameWithFallback} {item.badge_symbol}
          </span>
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <style>{`
        @keyframes medalShimmer {
          0%   { box-shadow: 0 0 0px #fbbf24; transform: scale(1) rotate(0deg); }
          25%  { box-shadow: 0 0 30px #fbbf24, 0 0 60px #f59e0b88; transform: scale(1.1) rotate(5deg); }
          75%  { box-shadow: 0 0 20px #fbbf24, 0 0 40px #f59e0b66; transform: scale(1.05) rotate(-3deg); }
          100% { box-shadow: 0 0 0px #fbbf24; transform: scale(1) rotate(0deg); }
        }
      `}</style>
      <div
        className="flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500 text-5xl select-none"
        style={{ animation: 'medalShimmer 2.5s ease-in-out infinite' }}
      >
        {item.badge_symbol ?? '🏅'}
      </div>
      {item.is_temporary && item.available_until && (
        <p className="text-xs text-amber-400 font-medium">Disponible hasta {formatDate(item.available_until)}</p>
      )}
    </div>
  )
}

type Props = {
  item: ShopItem
  inventoryItem?: UserInventoryItem
  userId: string
  balance: number
  /** Avatar actual para previsualizar marcos en el modal. */
  framePreviewUser?: FramePreviewUser | null
  onClose: () => void
  refetchProfile: () => void | Promise<void>
  onPurchaseSuccess: (purchased: ShopItem) => void
}

export function ShopItemDetailModal({
  item,
  inventoryItem,
  userId,
  balance,
  framePreviewUser,
  onClose,
  refetchProfile,
  onPurchaseSuccess,
}: Props) {
  const qc = useQueryClient()
  const buyMutation = useBuyShopItem(userId)
  const equipMutation = useEquipShopItem(userId)
  const unequipMutation = useUnequipShopItemType(userId)

  const owned = !!inventoryItem
  const equipped = inventoryItem?.is_equipped ?? false
  const expired = inventoryItem?.expires_at ? new Date(inventoryItem.expires_at) < new Date() : false
  const canEquip =
    owned &&
    !expired &&
    (item.item_type === 'name_color' || item.item_type === 'badge' || item.item_type === 'avatar_frame')
  const purchasable = item.is_purchasable !== false
  const canBuy = !owned && purchasable && balance >= item.cost_piedritas

  const isPending = buyMutation.isPending || equipMutation.isPending || unequipMutation.isPending
  const mutationError =
    buyMutation.error ?? equipMutation.error ?? unequipMutation.error

  const handleBuy = async () => {
    await buyMutation.mutateAsync(item.id)
    await qc.refetchQueries({ queryKey: ['user_inventory', userId] })
    try {
      if (item.item_type === 'name_color' || item.item_type === 'badge') {
        await equipMutation.mutateAsync(item.id)
        await qc.refetchQueries({ queryKey: ['user_inventory', userId] })
      }
    } catch {
      /* compra ok; equip opcional */
    }
    try {
      await refetchProfile()
    } finally {
      onPurchaseSuccess(item)
      buyMutation.reset()
    }
  }

  const handleEquipToggle = async () => {
    if (equipped) {
      await unequipMutation.mutateAsync(item.item_type)
      unequipMutation.reset()
    } else {
      await equipMutation.mutateAsync(item.id)
      equipMutation.reset()
    }
    await refetchProfile()
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-app-border bg-app-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`px-6 pt-6 pb-2 rounded-t-3xl ${
            item.item_type === 'name_color'
              ? 'bg-app-surface'
              : item.item_type === 'badge'
                ? 'bg-gradient-to-br from-violet-950/40 to-app-surface'
                : item.item_type === 'avatar_frame'
                  ? 'bg-gradient-to-br from-amber-950/35 via-app-surface to-rose-950/25'
                  : 'bg-gradient-to-br from-amber-950/40 to-app-surface'
          }`}
        >
          <ItemAnimation item={item} framePreviewUser={framePreviewUser} />
        </div>

        <div className="px-6 pb-6 space-y-4">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-bold text-app-foreground">{item.name}</h3>
              {item.is_couple_item && (
                <span className="text-xs bg-pink-500/20 text-pink-400 border border-pink-500/30 px-2 py-0.5 rounded-full shrink-0">
                  💑 pareja
                </span>
              )}
            </div>
            {item.description && (
              <p className="text-sm text-app-muted mt-1">{item.description}</p>
            )}
            {!owned && item.is_temporary && item.available_until && (
              <p className="text-xs text-amber-400 mt-1">
                En tienda hasta el {formatDate(item.available_until)} · después no podrás comprarlo aquí
              </p>
            )}
            {owned && inventoryItem?.expires_at && (
              <p className="text-xs text-amber-400/90 mt-1">
                Caduca el {formatDate(inventoryItem.expires_at)}
              </p>
            )}
          </div>

          {mutationError && (
            <p className="text-sm text-red-500">
              {mutationError instanceof Error ? mutationError.message : 'Error'}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {!owned && purchasable && (
              <Button
                className="flex-1"
                onClick={() => void handleBuy()}
                loading={buyMutation.isPending}
                disabled={!canBuy || isPending}
              >
                {canBuy ? `Comprar · ${item.cost_piedritas} 💎` : `${item.cost_piedritas} 💎 (sin saldo)`}
              </Button>
            )}
            {!owned && !purchasable && (
              <p className="min-w-[12rem] flex-1 text-xs text-app-muted leading-snug self-center">
                {item.item_type === 'avatar_frame' ? (
                  <>
                    Premio por completar la historia{' '}
                    <span className="text-app-foreground font-medium">Cuatro atardeceres en Roma</span>
                    : terminá las misiones del último día. No se compra con Piedritas.
                  </>
                ) : (
                  <>
                    Este ítem no está a la venta. Lo conseguís completando la historia u otros eventos.
                  </>
                )}
              </p>
            )}
            {canEquip && (
              <Button
                variant={equipped ? 'outline' : 'secondary'}
                className="flex-1"
                onClick={() => void handleEquipToggle()}
                loading={equipMutation.isPending || unequipMutation.isPending}
                disabled={isPending}
              >
                {equipped ? 'Desequipar' : 'Equipar'}
              </Button>
            )}
            {owned && expired && (
              <p className="text-sm text-app-muted">Este ítem ha expirado.</p>
            )}
            {owned && !canEquip && !expired && item.item_type === 'medal' && (
              <p className="text-xs text-app-muted">Las medallas son decorativas.</p>
            )}
            <Button variant="ghost" onClick={onClose} disabled={isPending}>
              ✕
            </Button>
          </div>

          {!owned && (
            <p className="text-xs text-center text-app-muted tabular-nums">
              Tu saldo: <span className="text-app-foreground font-semibold">{balance} 💎</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
