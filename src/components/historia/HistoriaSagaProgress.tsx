import { Fragment } from 'react'
import type { HistoriaChapter, HistoriaMission } from '@/hooks/useHistoria'
import { formatDate } from '@/lib/utils'

function flattenMissions(chapters: HistoriaChapter[]): HistoriaMission[] {
  return [...chapters]
    .sort((a, b) => a.order_number - b.order_number)
    .flatMap((ch) => [...ch.missions].sort((a, b) => a.order_number - b.order_number))
}

function missionComplete(m: HistoriaMission): boolean {
  return m.progress?.is_complete ?? false
}

function daysRemainingMadrid(storyEndDate: string, todayISO: string): number {
  if (todayISO > storyEndDate) return 0
  const t = new Date(`${todayISO}T12:00:00`)
  const e = new Date(`${storyEndDate}T12:00:00`)
  return Math.max(0, Math.round((e.getTime() - t.getTime()) / 86_400_000))
}

function storyDurationDaysInclusive(start: string, end: string): number {
  const s = new Date(`${start}T12:00:00`)
  const e = new Date(`${end}T12:00:00`)
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1)
}

function sagaStats(chapters: HistoriaChapter[]) {
  const missions = flattenMissions(chapters)
  const total = missions.length
  const completed = missions.filter(missionComplete).length
  const maxPiedritas = missions.reduce((s, m) => s + m.reward_piedritas, 0)
  const earnedPiedritas = missions.filter((m) => m.claimed).reduce((s, m) => s + m.reward_piedritas, 0)
  return { missions, total, completed, maxPiedritas, earnedPiedritas }
}

function TimelineNode({
  mission,
  index,
  missionsCount,
}: {
  mission: HistoriaMission
  index: number
  missionsCount: number
}) {
  const done = missionComplete(mission)
  const isLast = index === missionsCount - 1

  return (
    <div
      className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold tabular-nums transition-colors ${
        done
          ? 'border-emerald-400 bg-emerald-500 text-white'
          : 'border-app-border bg-app-surface-alt text-app-muted'
      }`}
      title={mission.title}
    >
      {done ? (
        <span aria-hidden>✓</span>
      ) : isLast && missionsCount > 1 ? (
        <span aria-hidden className="text-sm leading-none">
          👑
        </span>
      ) : (
        index + 1
      )}
    </div>
  )
}

type Variant = 'compact' | 'full'

export function HistoriaSagaProgress({
  storyName,
  storyStartDate,
  storyEndDate,
  chapters,
  todayISO,
  variant,
  showTitle = true,
}: {
  storyName: string
  storyStartDate: string
  storyEndDate: string
  chapters: HistoriaChapter[]
  todayISO: string
  variant: Variant
  /** En la tarjeta del dashboard el título va fuera; ocultar duplicado. */
  showTitle?: boolean
}) {
  const { missions, total, completed, maxPiedritas, earnedPiedritas } = sagaStats(chapters)
  const pct = total > 0 ? (completed / total) * 100 : 0
  const restantes = daysRemainingMadrid(storyEndDate, todayISO)
  const duración = storyDurationDaysInclusive(storyStartDate, storyEndDate)

  return (
    <div className={variant === 'full' ? 'space-y-4' : 'space-y-3'}>
      {variant === 'full' && showTitle && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wide text-app-accent">Historia activa</span>
          <span className="rounded-full border border-app-border bg-app-bg px-2.5 py-0.5 text-app-muted tabular-nums">
            {restantes} {restantes === 1 ? 'día restante' : 'días restantes'}
          </span>
        </div>
      )}

      {variant === 'full' && showTitle && (
        <>
          <h2 className="text-xl font-bold text-app-foreground leading-tight">{storyName}</h2>
          <p className="text-sm text-app-muted">
            {formatDate(storyStartDate)} → {formatDate(storyEndDate)} · {duración}{' '}
            {duración === 1 ? 'día' : 'días'}
          </p>
        </>
      )}

      {/* Barra global */}
      <div>
        <div
          className="relative h-2 w-full overflow-hidden rounded-full bg-app-bg border border-app-border"
          role="progressbar"
          aria-valuenow={completed}
          aria-valuemin={0}
          aria-valuemax={Math.max(total, 1)}
        >
          {pct > 0 && (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-teal-400 via-cyan-500 to-violet-600 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
        <div
          className={`mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-app-muted ${variant === 'compact' ? '' : ''}`}
        >
          <span className="tabular-nums">
            {completed}/{total} {total === 1 ? 'misión completada' : 'misiones completadas'}
          </span>
          <span className="tabular-nums flex items-center gap-1">
            <span aria-hidden>💎</span>
            <span className="font-medium text-app-accent">
              {earnedPiedritas} / {maxPiedritas} piedritas
            </span>
          </span>
        </div>
      </div>

      {/* Timeline: ancho completo; tramos flex entre nodos */}
      {total > 0 && (
        <div className="w-full pb-1">
          {missions.length === 1 ? (
            <div className="flex w-full justify-center">
              <TimelineNode
                mission={missions[0]!}
                index={0}
                missionsCount={missions.length}
              />
            </div>
          ) : (
            <div className="flex w-full min-w-0 items-center">
              {missions.map((m, index) => {
                const done = missionComplete(m)
                const prev = index > 0 ? missions[index - 1]! : null
                const connectorGreen = prev != null && missionComplete(prev) && done

                return (
                  <Fragment key={m.id}>
                    {index > 0 && (
                      <div
                        className={`h-0.5 min-w-1 flex-1 basis-0 rounded-full ${
                          connectorGreen ? 'bg-emerald-500' : 'bg-app-border'
                        }`}
                        aria-hidden
                      />
                    )}
                    <TimelineNode mission={m} index={index} missionsCount={missions.length} />
                  </Fragment>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
