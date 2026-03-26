import { useMemo } from 'react'
import { useActiveHistoriaState, useClaimHistoriaMissionReward } from '@/hooks/useHistoria'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'

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
      <div className="bg-app-surface rounded-2xl p-6 shadow-sm border border-app-border">
        <h1 className="text-xl font-bold text-app-foreground mb-2">Historia</h1>
        {!story ? (
          <p className="text-sm text-app-muted">No hay una historia planificada/activa.</p>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-app-foreground">{story.name}</h2>
            <p className="text-sm text-app-muted mt-1">
              {formatDate(story.start_date)} – {formatDate(story.end_date)}
            </p>
            {profile?.piedritas_balance !== undefined && (
              <p className="text-sm text-app-muted mt-2 tabular-nums">
                Tu saldo: <span className="text-app-foreground font-semibold">{profile.piedritas_balance} Piedritas</span>
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
                    const progressText = `${mission.progress?.progress_value ?? 0}/${mission.progress?.progress_target ?? '?'}`
                    return (
                      <div
                        key={mission.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-app-surface border border-app-border"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-app-foreground">{mission.title}</p>
                          {mission.description && (
                            <p className="text-xs text-app-muted mt-1 leading-relaxed">{mission.description}</p>
                          )}
                          <p className="text-xs text-app-muted mt-1.5">
                            Progreso:{' '}
                            <span className="tabular-nums text-app-foreground font-semibold">{progressText}</span> · Premio:{' '}
                            <span className="tabular-nums text-app-accent font-semibold">{mission.reward_piedritas} 💎</span>
                          </p>
                          {mission.claimed && <p className="text-xs text-green-400 mt-1">✓ Reclamado</p>}
                        </div>
                        <div className="shrink-0">
                          <Button
                            size="sm"
                            disabled={!canClaim || claimMutation.isPending}
                            onClick={() => void claimMutation.mutateAsync(mission.id)}
                          >
                            {claimMutation.isPending && canClaim ? 'Reclamando…' : canClaim ? 'Reclamar' : 'Pendiente'}
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
        <p className="text-sm text-app-muted">Aún no hay capítulos/misiones.</p>
      )}
    </div>
  )
}

