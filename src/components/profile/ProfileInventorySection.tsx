import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useUserInventory } from '@/hooks/useShop'
import { ShopTypeTabs } from '@/components/shop/ShopTypeTabs'
import { ShopItemCard } from '@/components/shop/ShopItemCard'
import { ShopItemDetailModal } from '@/components/shop/ShopItemDetailModal'
import { userInventoryToShopItem } from '@/components/shop/userInventoryToShopItem'
import { Button } from '@/components/ui/Button'
import type { ShopItem, ShopItemType, UserInventoryItem } from '@/types'

type Props = {
  userId: string
  refetchProfile: () => void | Promise<void>
}

export function ProfileInventorySection({ userId, refetchProfile }: Props) {
  const { profile } = useAuth()
  const balance = profile?.piedritas_balance ?? 0
  const { data: inventory = [], isLoading, isError, error, refetch } = useUserInventory(userId)

  const [activeTab, setActiveTab] = useState<ShopItemType>('name_color')
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null)

  const sorted = useMemo(() => {
    return [...inventory].sort((a, b) => {
      if (a.is_equipped !== b.is_equipped) return a.is_equipped ? -1 : 1
      return new Date(b.acquired_at).getTime() - new Date(a.acquired_at).getTime()
    })
  }, [inventory])

  const soloItems = useMemo(() => sorted.filter((i) => !i.is_couple_item), [sorted])
  const coupleItems = useMemo(() => sorted.filter((i) => i.is_couple_item), [sorted])

  const inTab = useMemo(() => soloItems.filter((i) => i.item_type === activeTab), [soloItems, activeTab])

  const inventoryByItemId = useMemo(() => new Map(sorted.map((i) => [i.item_id, i])), [sorted])

  const openDetail = (row: UserInventoryItem) => {
    setSelectedItem(userInventoryToShopItem(row))
  }

  if (isLoading) {
    return (
      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-app-foreground">Inventario</h3>
        </div>
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse h-36 bg-app-surface rounded-2xl border border-app-border"
          />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <section className="mt-6 rounded-2xl border border-red-800/40 bg-app-surface p-4">
        <h3 className="text-base font-semibold text-app-foreground">Inventario</h3>
        <p className="text-sm text-red-600 dark:text-red-400 mt-2">
          No se pudo cargar el inventario
          {error instanceof Error ? `: ${error.message}` : ''}.
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
          Reintentar
        </Button>
      </section>
    )
  }

  if (sorted.length === 0) {
    return (
      <section className="mt-6 rounded-2xl border border-app-border bg-app-surface p-4">
        <h3 className="text-base font-semibold text-app-foreground">Inventario</h3>
        <p className="text-sm text-app-muted mt-2">
          Aún no tienes objetos cosméticos.{' '}
          <Link to="/tienda" className="text-app-accent font-medium underline-offset-2 hover:underline">
            Visita la tienda
          </Link>
        </p>
      </section>
    )
  }

  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-app-foreground">Inventario</h3>
        <Link
          to="/tienda"
          className="text-xs text-app-accent font-medium underline-offset-2 hover:underline"
        >
          Ir a la tienda
        </Link>
      </div>

      <ShopTypeTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {inTab.length === 0 ? (
        <div className="text-center py-10 text-app-muted text-sm rounded-2xl border border-app-border bg-app-surface px-4">
          No tienes objetos en esta categoría.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {inTab.map((row) => {
            const shopItem = userInventoryToShopItem(row)
            return (
              <ShopItemCard
                key={row.id}
                item={shopItem}
                inventoryItem={row}
                onClick={() => openDetail(row)}
              />
            )
          })}
        </div>
      )}

      {coupleItems.length > 0 && (
        <div className="space-y-3 pt-2">
          <h4 className="text-sm font-semibold text-app-foreground flex items-center gap-2">
            💑 En pareja
            <span className="text-xs text-app-muted font-normal">Objetos compartidos</span>
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {coupleItems.map((row) => {
              const shopItem = userInventoryToShopItem(row)
              return (
                <ShopItemCard
                  key={row.id}
                  item={shopItem}
                  inventoryItem={row}
                  onClick={() => openDetail(row)}
                />
              )
            })}
          </div>
        </div>
      )}

      {selectedItem && (
        <ShopItemDetailModal
          item={selectedItem}
          inventoryItem={inventoryByItemId.get(selectedItem.id)}
          userId={userId}
          balance={balance}
          onClose={() => setSelectedItem(null)}
          refetchProfile={refetchProfile}
          onPurchaseSuccess={() => setSelectedItem(null)}
        />
      )}
    </section>
  )
}
