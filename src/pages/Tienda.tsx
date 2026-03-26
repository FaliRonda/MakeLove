import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useShopItems, useUserInventory, useBuyShopItem, useEquipShopItem, useUnequipShopItemType } from '@/hooks/useShop'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import type { ShopItem, UserInventoryItem, ShopItemType } from '@/types'

// ---- Animación del ítem en modal ----

function ItemAnimation({ item }: { item: ShopItem }) {
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
          className="text-2xl font-bold tracking-wide"
          style={{
            color: item.color_value,
            animation: 'colorPulse 2s ease-in-out infinite',
          }}
        >
          Tu nombre aquí
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
          Aparece junto a tu nombre: <span className="text-app-foreground font-semibold">Tu nombre {item.badge_symbol}</span>
        </p>
      </div>
    )
  }

  // Medal
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
        <p className="text-xs text-amber-400 font-medium">
          Disponible hasta {formatDate(item.available_until)}
        </p>
      )}
    </div>
  )
}

// ---- Tarjeta de ítem ----

function ItemCard({
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
  const expired =
    inventoryItem?.expires_at ? new Date(inventoryItem.expires_at) < new Date() : false

  return (
    <button
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

      {/* Icono del ítem */}
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
        <span className="text-xs text-green-400">
          {expired ? 'Expirado' : 'Tuyo'}
        </span>
      ) : (
        <span className="text-xs font-bold text-app-accent tabular-nums">
          {item.cost_piedritas} 💎
        </span>
      )}
    </button>
  )
}

// ---- Modal de detalle ----

function ItemModal({
  item,
  inventoryItem,
  userId,
  balance,
  onClose,
}: {
  item: ShopItem
  inventoryItem?: UserInventoryItem
  userId: string
  balance: number
  onClose: () => void
}) {
  const buyMutation = useBuyShopItem(userId)
  const equipMutation = useEquipShopItem(userId)
  const unequipMutation = useUnequipShopItemType(userId)

  const owned = !!inventoryItem
  const equipped = inventoryItem?.is_equipped ?? false
  const expired = inventoryItem?.expires_at ? new Date(inventoryItem.expires_at) < new Date() : false
  const canEquip = owned && !expired && (item.item_type === 'name_color' || item.item_type === 'badge')
  const canBuy = !owned && balance >= item.cost_piedritas

  const isPending = buyMutation.isPending || equipMutation.isPending || unequipMutation.isPending
  const mutationError =
    buyMutation.error ?? equipMutation.error ?? unequipMutation.error

  const handleBuy = async () => {
    await buyMutation.mutateAsync(item.id)
    buyMutation.reset()
  }

  const handleEquipToggle = async () => {
    if (equipped) {
      await unequipMutation.mutateAsync(item.item_type)
      unequipMutation.reset()
    } else {
      await equipMutation.mutateAsync(item.id)
      equipMutation.reset()
    }
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
        {/* Header con gradiente según tipo */}
        <div
          className={`px-6 pt-6 pb-2 ${
            item.item_type === 'name_color'
              ? 'bg-gradient-to-br from-app-bg to-app-surface'
              : item.item_type === 'badge'
              ? 'bg-gradient-to-br from-violet-950/40 to-app-surface'
              : 'bg-gradient-to-br from-amber-950/40 to-app-surface'
          }`}
        >
          <ItemAnimation item={item} />
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
            {item.is_temporary && item.available_until && (
              <p className="text-xs text-amber-400 mt-1">
                Temporal · disponible hasta {formatDate(item.available_until)}
              </p>
            )}
          </div>

          {mutationError && (
            <p className="text-sm text-red-500">
              {mutationError instanceof Error ? mutationError.message : 'Error'}
            </p>
          )}

          <div className="flex gap-2">
            {!owned && (
              <Button
                className="flex-1"
                onClick={() => void handleBuy()}
                loading={buyMutation.isPending}
                disabled={!canBuy || isPending}
              >
                {canBuy ? `Comprar · ${item.cost_piedritas} 💎` : `${item.cost_piedritas} 💎 (sin saldo)`}
              </Button>
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

// ---- Sección por tipo ----

const TYPE_LABELS: Record<ShopItemType, string> = {
  name_color: '🎨 Colores de nombre',
  badge: '✦ Insignias',
  medal: '🏅 Medallas',
}

const TYPE_ORDER: ShopItemType[] = ['name_color', 'badge', 'medal']

// ---- Página principal ----

export function Tienda() {
  const { profile } = useAuth()
  const userId = profile?.id
  const balance = profile?.piedritas_balance ?? 0

  const { data: shopItems = [], isLoading: loadingItems } = useShopItems()
  const { data: inventory = [], isLoading: loadingInventory } = useUserInventory(userId)

  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null)
  const [activeTab, setActiveTab] = useState<ShopItemType>('name_color')

  const inventoryMap = new Map(inventory.map((i) => [i.item_id, i]))

  const itemsByType = TYPE_ORDER.reduce<Record<ShopItemType, ShopItem[]>>(
    (acc, t) => {
      acc[t] = shopItems.filter((i) => i.item_type === t && !i.is_couple_item)
      return acc
    },
    { name_color: [], badge: [], medal: [] }
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
      {/* Cabecera */}
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

      {/* Tabs */}
      <div className="flex gap-1 bg-app-bg rounded-xl p-1 border border-app-border">
        {TYPE_ORDER.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-colors ${
              activeTab === t
                ? 'bg-app-surface text-app-foreground shadow-sm'
                : 'text-app-muted hover:text-app-foreground'
            }`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Grid de ítems activos */}
      {itemsByType[activeTab].length === 0 ? (
        <div className="text-center py-12 text-app-muted text-sm">
          No hay ítems disponibles en esta categoría todavía.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {itemsByType[activeTab].map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              inventoryItem={inventoryMap.get(item.id)}
              onClick={() => setSelectedItem(item)}
            />
          ))}
        </div>
      )}

      {/* Sección En Pareja */}
      {coupleItems.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-app-foreground flex items-center gap-2">
            💑 En Pareja
            <span className="text-xs text-app-muted font-normal">Ambos lo recibís al comprar</span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {coupleItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                inventoryItem={inventoryMap.get(item.id)}
                onClick={() => setSelectedItem(item)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Inventario equipado */}
      {inventory.filter((i) => i.is_equipped).length > 0 && (
        <section className="bg-app-surface rounded-2xl border border-app-border p-4 space-y-2">
          <h2 className="text-sm font-semibold text-app-foreground">Actualmente equipado</h2>
          {inventory
            .filter((i) => i.is_equipped)
            .map((i) => (
              <div key={i.id} className="flex items-center gap-3">
                {i.item_type === 'name_color' && i.color_value ? (
                  <div
                    className="w-6 h-6 rounded-full shrink-0"
                    style={{ background: i.color_value }}
                  />
                ) : (
                  <span className="text-xl select-none shrink-0">{i.badge_symbol ?? '🏅'}</span>
                )}
                <span className="text-sm text-app-foreground">{i.name}</span>
                <span className="ml-auto text-xs text-app-muted">{TYPE_LABELS[i.item_type]}</span>
              </div>
            ))}
        </section>
      )}

      {/* Modal detalle */}
      {selectedItem && userId && (
        <ItemModal
          item={selectedItem}
          inventoryItem={inventoryMap.get(selectedItem.id)}
          userId={userId}
          balance={balance}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
