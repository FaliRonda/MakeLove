import { useMemo } from 'react'
import { useActiveHistoriaState, useClaimHistoriaMissionReward } from '@/hooks/useHistoria'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import { HistoriaSagaProgress } from '@/components/historia/HistoriaSagaProgress'
import { missionObjectiveLine, type MissionMetricType } from '@/lib/historiaObjective'

function todayMadridISODate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find((p) => p.type === 'year')?.value ?? '0000'
  const month = parts.find((p) => p.type === 'month')?.value ?? '00'
  const day = parts.find((p) => p.type === 'day')?.value ?? '00'
  return `${year}-${month}-${day}`
}

function MissionProgressBar({
  value,
  target,
  complete,
}: {
  value: number
  target: number
  complete: boolean
}) {
  if (target <= 0) return null
  const pct = complete ? 100 : Math.min(100, (value / target) * 100)
  return (
    <div className="mt-2">
      <div className="flex justify-end text-xs text-app-muted mb-0.5 tabular-nums">
        <span className="font-semibold text-app-foreground">
          {value} / {target}
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-app-bg border border-app-border">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-pink-500 via-rose-400 to-orange-400 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function Historia() {
  const { profile } = useAuth()
  const userId = profile?.id
  const { data: historiaState, isLoading, error } = useActiveHistoriaState(userId)
  const claimMutation = useClaimHistoriaMissionReward(userId)

  const todayISO = useMemo(() => todayMadridISODate(), [])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-app-foreground">Historia</h1>
        <div className="animate-pulse h-28 bg-app-surface-alt rounded-xl" />
        <div className="animate-pulse h-28 bg-app-surface-alt rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-bold text-app-foreground">Historia</h1>
        <p className="text-sm text-red-600">{error instanceof Error ? error.message : 'Error al cargar'}</p>
      </div>
    )
  }

  const story = historiaState?.story ?? null

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-app-border bg-app-surface p-6 shadow-sm">
        <h1 className="text-xl font-bold text-app-foreground mb-4">Historia</h1>
        {!story ? (
          <p className="text-sm text-app-muted">No hay una historia planificada/activa.</p>
        ) : (
          <>
            {historiaState?.chapters?.length ? (
              <HistoriaSagaProgress
                storyName={story.name}
                storyStartDate={story.start_date}
                storyEndDate={story.end_date}
                chapters={historiaState.chapters}
                todayISO={todayISO}
                variant="full"
              />
            ) : (
              <>
                <h2 className="text-lg font-semibold text-app-foreground">{story.name}</h2>
                <p className="text-sm text-app-muted mt-1">
                  {formatDate(story.start_date)} – {formatDate(story.end_date)}
                </p>
              </>
            )}
            {profile?.piedritas_balance !== undefined && (
              <p className="text-sm text-app-muted mt-4 tabular-nums">
                Tu saldo:{' '}
                <span className="text-app-foreground font-semibold">{profile.piedritas_balance} piedritas</span>
              </p>
            )}
          </>
        )}
      </div>

      {story && historiaState?.chapters?.length ? (
        <div className="space-y-5">
          {historiaState.chapters.map((chapter) => {
            const chapterExpired = todayISO > chapter.end_date
            return (
              <section key={chapter.id} className="bg-app-bg border border-app-border rounded-2xl p-4">
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-app-foreground">
                      Capítulo {chapter.order_number} · {chapter.name}
                    </h3>
                    <p className="text-sm text-app-muted mt-1">
                      {formatDate(chapter.start_date)} – {formatDate(chapter.end_date)}
                    </p>
                  </div>
                  {chapterExpired && (
                    <span className="text-xs text-red-300 bg-red-900/30 border border-red-800/50 px-2 py-1 rounded-lg">
                      Caducado
                    </span>
                  )}
                </header>

                <div className="mt-3 space-y-2">
                  {chapter.missions.map((mission) => {
                    const canClaim = mission.progress?.is_complete && !mission.claimed && !chapterExpired
                    const pv = mission.progress?.progress_value ?? 0
                    const pt = mission.progress?.progress_target ?? 0

                    return (
                      <div
                        key={mission.id}
                        className="flex items-stretch justify-between gap-3 p-3 rounded-xl bg-app-surface border border-app-border"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-app-muted">
                              Misión {mission.order_number}
                            </span>
                            <span className="text-xs tabular-nums font-semibold text-app-accent">
                              +{mission.reward_piedritas} 💎
                            </span>
                          </div>
                          <p className="font-medium text-app-foreground mt-1">{mission.title}</p>
                          {mission.description ? (
                            <p className="text-xs text-app-muted mt-1 leading-relaxed italic">{mission.description}</p>
                          ) : null}

                          {mission.requirements && mission.requirements.length > 0 ? (
                            <div className="mt-2 space-y-1 text-xs text-app-muted leading-snug">
                              {mission.requirements.map((req, idx) => (
                                <p key={`${mission.id}-req-${idx}`} className="flex gap-1.5">
                                  <span className="text-app-accent shrink-0" aria-hidden>
                                    ◎
                                  </span>
                                  <span>
                                    {missionObjectiveLine(
                                      req.metric_type as MissionMetricType,
                                      req.required_amount,
                                      mission.target_type
                                    )}
                                  </span>
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-app-muted mt-2">
                              Sigue el objetivo descrito por la misión; el progreso se actualiza automáticamente.
                            </p>
                          )}

                          <MissionProgressBar
                            value={pv}
                            target={pt}
                            complete={mission.progress?.is_complete ?? false}
                          />

                          {mission.claimed && (
                            <p className="text-xs text-emerald-400 mt-2 font-medium">✓ Reclamado</p>
                          )}
                        </div>
                        <div className="shrink-0 flex flex-col justify-center">
                          <Button
                            size="sm"
                            disabled={!canClaim || claimMutation.isPending}
                            onClick={() => void claimMutation.mutateAsync(mission.id)}
                          >
                            {claimMutation.isPending && canClaim
                              ? 'Reclamando…'
                              : canClaim
                                ? 'Reclamar'
                                : mission.claimed
                                  ? 'Listo'
                                  : 'Pendiente'}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        story && <p className="text-sm text-app-muted">Aún no hay capítulos/misiones.</p>
      )}
    </div>
  )
}
