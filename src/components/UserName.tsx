interface UserNameProps {
  name: string
  nameColor?: string | null
  badge?: string | null
  className?: string
}

export function UserName({ name, nameColor, badge, className }: UserNameProps) {
  return (
    <span className={className}>
      <span style={nameColor ? { color: nameColor } : undefined}>{name}</span>
      {badge && <span className="ml-1 select-none" aria-hidden="true">{badge}</span>}
    </span>
  )
}
