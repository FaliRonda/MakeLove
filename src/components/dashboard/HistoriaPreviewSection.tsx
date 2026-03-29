import { Link } from 'react-router-dom'
import { useActiveHistoriaState } from '@/hooks/useHistoria'
import { formatDate } from '@/lib/utils'
import { HistoriaSagaProgress } from '@/components/historia/HistoriaSagaProgress'

function daysRemainingMadrid(storyEndDate: string, todayISO: string): number {
  if (todayISO > storyEndDate) return 0
  const t = new Date(`${todayISO}T12:00:00`)
  const e = new Date(`${storyEndDate}T12:00:00`)
  return Math.max(0, Math.round((e.getTime() - t.getTime()) / 86_400_000))
}

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
  if (!story || !historiaState?.chapters?.length) return null

  const activeChapter =
    historiaState.chapters.find((ch) => ch.start_date <= todayISO && todayISO <= ch.end_date) ??
    historiaState.chapters[0] ??
    null

  const allMissions = historiaState.chapters.flatMap((ch) => ch.missions)
  const claimable = allMissions.filter((m) => m.progress?.is_complete && !m.claimed)
  const restantes = daysRemainingMadrid(story.end_date, todayISO)

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
          <p className="text-xs text-app-muted">{formatDate(story.start_date)} – {formatDate(story.end_date)}</p>
          <p className="text-[11px] text-app-muted tabular-nums mt-0.5 whitespace-nowrap">
            {restantes} {restantes === 1 ? 'día restante' : 'días restantes'}
          </p>
        </div>
      </div>

      <HistoriaSagaProgress
        storyName={story.name}
        storyStartDate={story.start_date}
        storyEndDate={story.end_date}
        chapters={historiaState.chapters}
        todayISO={todayISO}
        variant="compact"
        showTitle={false}
      />
    </Link>
  )
}
