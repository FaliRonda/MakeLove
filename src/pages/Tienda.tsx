import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useShopItems, useUserInventory } from '@/hooks/useShop'
import { SHOP_TYPE_LABELS, SHOP_TYPE_ORDER } from '@/components/shop/shopConstants'
import { ShopTypeTabs } from '@/components/shop/ShopTypeTabs'
import { ShopItemCard } from '@/components/shop/ShopItemCard'
import {
  ItemAnimation,
  ShopItemDetailModal,
  type FramePreviewUser,
} from '@/components/shop/ShopItemDetailModal'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/ui/Button'
import type { ShopItem, ShopItemType } from '@/types'
import { resolveFrameOverlayUrl } from '@/lib/resolveFrameOverlayUrl'

function PurchaseSuccessModal({
  item,
  onClose,
  framePreviewUser,
}: {
  item: ShopItem
  onClose: () => void
  framePreviewUser?: FramePreviewUser | null
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-app-border bg-app-surface p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-success-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center">
          <div className="rounded-2xl border border-app-border/50 bg-app-bg/80 px-4 -mx-2 w-full">
            <ItemAnimation item={item} framePreviewUser={framePreviewUser} />
          </div>
        </div>
        <h3 id="purchase-success-title" className="text-lg font-semibold text-app-foreground text-center mt-2">
          ¡Enhorabuena!
        </h3>
        <p className="text-sm text-app-muted text-center mt-2">
          <span className="font-medium text-app-foreground">{item.name}</span>{' '}
          {item.item_type === 'medal'
            ? 'ya forma parte de tu colección.'
            : item.item_type === 'avatar_frame'
              ? 'ya es tuyo. Equípalo desde tu inventario o aquí para ver el marco en tu avatar.'
              : 'ya es tuyo y está activo en tu perfil. Puedes activarlo o desactivarlo cuando quieras desde tu inventario.'}
        </p>
        <p className="text-xs text-app-muted text-center mt-2 tabular-nums">
          Tu saldo de piedritas se ha actualizado.
        </p>
        <Button className="mt-6 w-full" type="button" onClick={onClose}>
          Aceptar
        </Button>
      </div>
    </div>
  )
}

export function Tienda() {
  const { profile, refetchProfile } = useAuth()
  const userId = profile?.id
  const balance = profile?.piedritas_balance ?? 0

  const { data: shopItems = [], isLoading: loadingItems } = useShopItems()
  const { data: inventory = [], isLoading: loadingInventory } = useUserInventory(userId)

  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null)
  const [purchaseCelebration, setPurchaseCelebration] = useState<ShopItem | null>(null)
  const [activeTab, setActiveTab] = useState<ShopItemType>('name_color')

  const inventoryMap = new Map(inventory.map((i) => [i.item_id, i]))

  const framePreviewUser: FramePreviewUser | undefined = profile
    ? {
        avatarUrl: profile.avatar_url
          ? `${profile.avatar_url}?t=${encodeURIComponent(profile.updated_at ?? '')}`
          : null,
        name: profile.name?.trim() || 'Tú',
      }
    : undefined

  const itemsByType = SHOP_TYPE_ORDER.reduce<Record<ShopItemType, ShopItem[]>>(
    (acc, t) => {
      acc[t] = shopItems.filter((i) => i.item_type === t && !i.is_couple_item)
      return acc
    },
    { name_color: [], badge: [], medal: [], avatar_frame: [] }
  )
  const coupleItems = shopItems.filter((i) => i.is_couple_item)

  const isLoading = loadingItems || loadingInventory

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-app-foreground">Tienda</h1>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse h-32 bg-app-surface rounded-2xl border border-app-border" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-app-foreground">Tienda</h1>
          <p className="text-sm text-app-muted mt-0.5">Gasta tus Piedritas en cosméticos exclusivos</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-app-muted">Tu saldo</p>
          <p className="text-lg font-bold text-app-accent tabular-nums">{balance} 💎</p>
        </div>
      </div>

      <ShopTypeTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {itemsByType[activeTab].length === 0 ? (
        <div className="text-center py-12 text-app-muted text-sm">
          No hay ítems disponibles en esta categoría todavía.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {itemsByType[activeTab].map((item) => (
            <ShopItemCard
              key={item.id}
              item={item}
              inventoryItem={inventoryMap.get(item.id)}
              onClick={() => setSelectedItem(item)}
            />
          ))}
        </div>
      )}

      {coupleItems.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-app-foreground flex items-center gap-2">
            💑 En Pareja
            <span className="text-xs text-app-muted font-normal">Ambos lo recibís al comprar</span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {coupleItems.map((item) => (
              <ShopItemCard
                key={item.id}
                item={item}
                inventoryItem={inventoryMap.get(item.id)}
                onClick={() => setSelectedItem(item)}
              />
            ))}
          </div>
        </section>
      )}

      {inventory.filter((i) => i.is_equipped).length > 0 && (
        <section className="bg-app-surface rounded-2xl border border-app-border p-4 space-y-2">
          <h2 className="text-sm font-semibold text-app-foreground">Actualmente equipado</h2>
          {inventory
            .filter((i) => i.is_equipped)
            .map((i) => {
              const equippedFrameSrc = resolveFrameOverlayUrl(i.frame_overlay_url)
              return (
              <div key={i.id} className="flex items-center gap-3">
                {i.item_type === 'name_color' && i.color_value ? (
                  <div
                    className="w-6 h-6 rounded-full shrink-0"
                    style={{ background: i.color_value }}
                  />
                ) : i.item_type === 'avatar_frame' && equippedFrameSrc ? (
                  <Avatar
                    avatarUrl={null}
                    name="?"
                    size="sm"
                    frameOverlayUrl={i.frame_overlay_url}
                    className="shrink-0 ring-1 ring-app-border"
                  />
                ) : (
                  <span className="text-xl select-none shrink-0">{i.badge_symbol ?? '🏅'}</span>
                )}
                <span className="text-sm text-app-foreground">{i.name}</span>
                <span className="ml-auto text-xs text-app-muted">{SHOP_TYPE_LABELS[i.item_type]}</span>
              </div>
              )
            })}
        </section>
      )}

      {selectedItem && userId && (
        <ShopItemDetailModal
          item={selectedItem}
          inventoryItem={inventoryMap.get(selectedItem.id)}
          userId={userId}
          balance={balance}
          framePreviewUser={framePreviewUser}
          onClose={() => setSelectedItem(null)}
          refetchProfile={refetchProfile}
          onPurchaseSuccess={(purchased) => {
            setSelectedItem(null)
            setPurchaseCelebration(purchased)
          }}
        />
      )}

      {purchaseCelebration && (
        <PurchaseSuccessModal
          item={purchaseCelebration}
          framePreviewUser={framePreviewUser}
          onClose={() => setPurchaseCelebration(null)}
        />
      )}
    </div>
  )
}
