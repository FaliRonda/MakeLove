import { cn } from '@/lib/utils'
import {
  Children,
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
} from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  asChild?: boolean
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  children,
  asChild,
  ...props
}: ButtonProps) {
  const classes = cn(
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-app-accent focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
    variant === 'primary' && 'bg-app-accent text-white hover:bg-app-accent-hover',
    variant === 'secondary' && 'bg-app-surface-alt text-app-foreground hover:bg-app-border-hover',
    variant === 'outline' && 'border-2 border-app-accent text-app-muted hover:bg-app-bg',
    variant === 'ghost' && 'text-app-muted hover:bg-app-bg',
    variant === 'danger' && 'bg-red-500 text-white hover:bg-red-600',
    size === 'sm' && 'px-3 py-1.5 text-sm',
    size === 'md' && 'px-4 py-2 text-base',
    size === 'lg' && 'px-6 py-3 text-lg',
    className
  )

  if (asChild) {
    const child = Children.only(children)
    if (!isValidElement<{ className?: string }>(child)) {
      throw new Error('Button with asChild expects a single React element child.')
    }
    const inactive = disabled || loading
    return cloneElement(child, {
      className: cn(classes, child.props.className, inactive && 'opacity-50 pointer-events-none'),
      ...(inactive ? { 'aria-disabled': true as const } : {}),
    })
  }

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="animate-pulse">...</span>
      ) : (
        children
      )}
    </button>
  )
}
