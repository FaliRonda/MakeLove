import { cn } from '@/lib/utils'

interface AvatarProps {
  avatarUrl: string | null
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-16 text-lg',
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function Avatar({ avatarUrl, name, size = 'md', className }: AvatarProps) {
  const sizeClass = sizeClasses[size]
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn('rounded-full object-cover shrink-0', sizeClass, className)}
      />
    )
  }
  return (
    <div
      className={cn(
        'rounded-full bg-app-bg border border-app-border flex items-center justify-center font-semibold text-app-muted shrink-0',
        sizeClass,
        className
      )}
      aria-hidden
    >
      {getInitials(name || '?')}
    </div>
  )
}
