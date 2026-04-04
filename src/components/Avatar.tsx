import { cn } from '@/lib/utils'
import { resolveFrameOverlayUrl } from '@/lib/resolveFrameOverlayUrl'

interface AvatarProps {
  avatarUrl: string | null
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** URL del marco (p. ej. /shop/venetian-mask.png); transparente en el centro; puede sobresalir del círculo. */
  frameOverlayUrl?: string | null
  className?: string
}

const sizeClasses = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-16 text-lg',
  xl: 'size-28 text-2xl',
}

/**
 * Marco veneciano: el hueco facial no coincide con el centro del shell; la foto se desplaza
 * en px (positivo = hacia abajo) tras centrar con translate(-50%, -50%).
 */
const frameShellClasses = {
  sm: 'size-[3.65rem]',
  md: 'size-[4.55rem]',
  lg: 'size-[7.3rem]',
  xl: 'size-[12.6rem]',
} as const

/** Diámetro del avatar con marco (algo mayor que size-* base). */
const framePhotoSizeClasses = {
  sm: 'size-[2.125rem] text-xs',
  md: 'size-[2.65rem] text-sm',
  lg: 'size-[4.28rem] text-lg',
  xl: 'size-[7.5rem] text-2xl',
} as const

/** Ajuste vertical de la foto (px); positivo baja el círculo dentro del óvalo del marco. */
const framePhotoNudgeYPx: Record<NonNullable<AvatarProps['size']>, number> = {
  sm: 2,
  md: 3,
  lg: 5,
  xl: 17,
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

export function Avatar({ avatarUrl, name, size = 'md', frameOverlayUrl, className }: AvatarProps) {
  const sizeClass = sizeClasses[size]
  const resolvedFrame = resolveFrameOverlayUrl(frameOverlayUrl)

  if (!resolvedFrame) {
    const shellClass = cn(
      'relative inline-flex shrink-0 align-middle rounded-full overflow-hidden',
      sizeClass,
      className
    )
    return (
      <span className={shellClass}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="size-full object-cover" />
        ) : (
          <div
            className="size-full flex items-center justify-center bg-app-bg font-semibold text-app-muted ring-1 ring-inset ring-app-border/55"
            aria-hidden
          >
            {getInitials(name || '?')}
          </div>
        )}
      </span>
    )
  }

  const outerClass = cn(
    'relative inline-flex shrink-0 items-center justify-center overflow-visible align-middle',
    frameShellClasses[size],
    className
  )

  const nudgeY = framePhotoNudgeYPx[size]

  return (
    <span className={outerClass}>
      <span
        className={cn(
          'absolute left-1/2 top-1/2 z-0 overflow-hidden rounded-full',
          framePhotoSizeClasses[size]
        )}
        style={{ transform: `translate(-50%, calc(-50% + ${nudgeY}px))` }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="size-full object-cover" />
        ) : (
          <div
            className="size-full flex items-center justify-center bg-app-bg font-semibold text-app-muted ring-1 ring-inset ring-app-border/55"
            aria-hidden
          >
            {getInitials(name || '?')}
          </div>
        )}
      </span>
      <img
        src={resolvedFrame}
        alt=""
        className="pointer-events-none absolute inset-0 z-10 size-full object-contain object-center select-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.38)]"
        aria-hidden
      />
    </span>
  )
}
