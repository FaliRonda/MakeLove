import { SHOP_TYPE_LABELS, SHOP_TYPE_ORDER } from '@/components/shop/shopConstants'
import type { ShopItemType } from '@/types'

export function ShopTypeTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: ShopItemType
  onTabChange: (t: ShopItemType) => void
}) {
  return (
    <div className="flex gap-1 bg-app-bg rounded-xl p-1 border border-app-border">
      {SHOP_TYPE_ORDER.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onTabChange(t)}
          className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-colors ${
            activeTab === t
              ? 'bg-app-surface text-app-foreground shadow-sm'
              : 'text-app-muted hover:text-app-foreground'
          }`}
        >
          {SHOP_TYPE_LABELS[t]}
        </button>
      ))}
    </div>
  )
}
