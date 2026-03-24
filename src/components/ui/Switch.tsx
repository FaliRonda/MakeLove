import { cn } from '@/lib/utils'

type SwitchProps = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  'aria-label'?: string
  className?: string
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  'aria-label': ariaLabel,
  className,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        'relative h-8 w-14 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-app-accent focus:ring-offset-2 focus:ring-offset-app-surface',
        checked ? 'bg-app-accent' : 'bg-app-border',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <span
        className={cn(
          'pointer-events-none absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-0'
        )}
      />
    </button>
  )
}
