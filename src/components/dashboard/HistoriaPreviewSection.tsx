import { Link } from 'react-router-dom'
import { useActiveHistoriaState } from '@/hooks/useHistoria'
import { formatDate } from '@/lib/utils'

function todayMadridISODate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year')?.value ?? '0000'
  const m = parts.find((p) => p.type === 'month')?.value ?? '00'
  const d = parts.find((p) => p.type === 'day')?.value ?? '00'
  return `${y}-${m}-${d}`
}

export function HistoriaPreviewSection({ userId }: { userId: string | undefined }) {
  const { data: historiaState, isLoading } = useActiveHistoriaState(userId)
  const todayISO = todayMadridISODate()

  if (isLoading) {
    return <div className="animate-pulse h-24 bg-app-surface rounded-2xl border border-app-border" />
  }

  const story = historiaState?.story
  if (!story) return null

  const activeChapter =
    historiaState.chapters.find((ch) => ch.start_date <= todayISO && todayISO <= ch.end_date) ??
    historiaState.chapters[0] ??
    null

  const allMissions = historiaState.chapters.flatMap((ch) => ch.missions)
  const totalMissions = allMissions.length
  const completedMissions = allMissions.filter((m) => m.claimed).length
  const claimable = allMissions.filter((m) => m.progress.is_complete && !m.claimed)
  const pendingPiedritas = claimable.reduce((s, m) => s + m.reward_piedritas, 0)
  const progressPct = totalMissions > 0 ? (completedMissions / totalMissions) * 100 : 0

  return (
    <Link
      to="/historia"
      className="block bg-app-surface rounded-2xl p-5 border border-app-border hover:border-app-border-hover transition-colors group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-xs text-app-muted font-medium uppercase tracking-wide mb-0.5">
            Historia activa ✨
          </p>
          <h2 className="text-base font-semibold text-app-foreground truncate group-hover:text-app-accent transition-colors">
            {story.name}
          </h2>
          {activeChapter && (
            <p className="text-xs text-app-muted mt-0.5">
              Cap. {activeChapter.order_number} · {activeChapter.name}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          {claimable.length > 0 && (
            <span className="inline-block bg-app-accent/90 text-white text-xs font-bold px-2 py-0.5 rounded-full mb-1">
              {claimable.length} por reclamar
            </span>
          )}
          <p className="text-xs text-app-muted">
            {formatDate(story.start_date)} – {formatDate(story.end_date)}
          </p>
        </div>
      </div>

      <div
        className="relative h-2 w-full overflow-hidden rounded-full bg-app-bg border border-app-border mb-2"
        role="progressbar"
        aria-valuenow={completedMissions}
        aria-valuemin={0}
        aria-valuemax={totalMissions}
      >
        {progressPct > 0 && (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-pink-500 via-rose-400 to-orange-400 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-app-muted">
        <span className="tabular-nums">
          {completedMissions}/{totalMissions} misiones reclamadas
        </span>
        {pendingPiedritas > 0 && (
          <span className="font-semibold text-app-accent tabular-nums">
            +{pendingPiedritas} 💎 disponibles
          </span>
        )}
      </div>
    </Link>
  )
}
