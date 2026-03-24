import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  useWeeklyCollabGoal,
  useClaimWeeklyCollabReward,
} from '@/hooks/useWeeklyCollabGoal'
import { formatDate } from '@/lib/utils'

const SEGMENTS = 4

/** Cofre cerrado: tapa abovedada, caja, bandas y herrajes estilo cofre del tesoro. */
function ChestClosedGrey() {
  return (
    <svg viewBox="0 0 48 48" className="h-14 w-14" aria-hidden>
      <path
        d="M9 24 A15 9 0 0 1 39 24 L39 25.5 L9 25.5 Z"
        fill="#64748b"
        opacity={0.9}
      />
      <path d="M9 25.5 H39 V39.5 A2 2 0 0 1 37 41.5 H11 A2 2 0 0 1 9 39.5 Z" fill="#475569" opacity={0.85} />
      <rect x="9" y="31" width="30" height="1.8" rx="0.5" fill="#334155" opacity={0.95} />
      <rect x="9" y="36" width="30" height="1.8" rx="0.5" fill="#334155" opacity={0.95} />
      <rect x="7.5" y="26" width="2.2" height="14" rx="0.4" fill="#94a3b8" opacity={0.7} />
      <rect x="38.3" y="26" width="2.2" height="14" rx="0.4" fill="#94a3b8" opacity={0.7} />
      <rect x="20" y="26.5" width="8" height="6.5" rx="1" fill="#64748b" stroke="#94a3b8" strokeWidth="0.8" />
      <circle cx="24" cy="29.5" r="2" fill="#cbd5e1" opacity={0.9} />
      <circle cx="24" cy="29.5" r="0.9" fill="#475569" />
    </svg>
  )
}

function ChestReadyGlow() {
  return (
    <svg viewBox="0 0 48 48" className="h-14 w-14" aria-hidden>
      <defs>
        <linearGradient id="weeklyChestWood" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="50%" stopColor="#0891b2" />
          <stop offset="100%" stopColor="#6d28d9" />
        </linearGradient>
        <linearGradient id="weeklyChestLid" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <path
        d="M9 24 A15 9 0 0 1 39 24 L39 25.5 L9 25.5 Z"
        fill="url(#weeklyChestLid)"
      />
      <path d="M9 25.5 H39 V39.5 A2 2 0 0 1 37 41.5 H11 A2 2 0 0 1 9 39.5 Z" fill="url(#weeklyChestWood)" />
      <rect x="9" y="31" width="30" height="1.8" rx="0.5" fill="#fbbf24" opacity={0.95} />
      <rect x="9" y="36" width="30" height="1.8" rx="0.5" fill="#fbbf24" opacity={0.95} />
      <rect x="7.5" y="26" width="2.2" height="14" rx="0.4" fill="#fcd34d" opacity={0.9} />
      <rect x="38.3" y="26" width="2.2" height="14" rx="0.4" fill="#fcd34d" opacity={0.9} />
      <rect x="20" y="26.5" width="8" height="6.5" rx="1" fill="#4c1d95" opacity={0.55} stroke="#fbbf24" strokeWidth="0.9" />
      <circle cx="24" cy="29.5" r="2" fill="#fde68a" />
      <circle cx="24" cy="29.5" r="0.85" fill="#78350f" />
    </svg>
  )
}

/** Cofre vacío / ya reclamado: tapa abierta hacia atrás, interior oscuro. */
function ChestOpenMuted() {
  return (
    <svg viewBox="0 0 48 48" className="h-14 w-14" aria-hidden>
      <path d="M9 26 H39 V39.5 A2 2 0 0 1 37 41.5 H11 A2 2 0 0 1 9 39.5 Z" fill="#57534e" opacity={0.55} />
      <path d="M11 28 H37 V38 H11 Z" fill="#292524" opacity={0.65} />
      <path
        d="M9 26 L39 26 L41 14.5 L11 14 Z"
        fill="#78716c"
        opacity={0.55}
      />
      <path d="M11 28 L37 28 L35 18 L14 17.5 Z" fill="#44403c" opacity={0.35} />
      <rect x="9" y="32" width="30" height="1.5" rx="0.4" fill="#57534e" opacity={0.6} />
      <rect x="7.5" y="26" width="2" height="12" rx="0.4" fill="#a8a29e" opacity={0.35} />
      <rect x="38.5" y="26" width="2" height="12" rx="0.4" fill="#a8a29e" opacity={0.35} />
    </svg>
  )
}

export function WeeklyGoalSection({
  enabled,
  refetchProfile,
}: {
  enabled: boolean
  refetchProfile: () => void | Promise<void>
}) {
  const { data: state, isLoading, isError } = useWeeklyCollabGoal(enabled)
  const claimMutation = useClaimWeeklyCollabReward()
  const [rewardModal, setRewardModal] = useState(false)

  const count = Math.min(state?.action_count ?? 0, SEGMENTS)
  const goal = state?.goal ?? SEGMENTS
  const reward = state?.reward_points ?? 20

  const openRewardModal = () => {
    if (state?.can_claim) setRewardModal(true)
  }

  const handleAcceptReward = () => {
    claimMutation.mutate(undefined, {
      onSuccess: async () => {
        await refetchProfile()
        setRewardModal(false)
        claimMutation.reset()
      },
    })
  }

  const closeModal = () => {
    if (!claimMutation.isPending) {
      setRewardModal(false)
      claimMutation.reset()
    }
  }

  const chestVariant =
    state?.claimed ? 'open' : state?.can_claim ? 'ready' : 'locked'

  return (
    <div className="bg-app-surface rounded-2xl p-6 shadow-sm border border-app-border">
      <h2 className="text-lg font-semibold text-app-foreground mb-1">Objetivo semanal</h2>
      <p className="text-sm text-app-muted mb-4">
        Entre los dos, registrad{' '}
        <span className="font-medium text-app-foreground">{goal} acciones</span> de lunes a domingo.
      </p>

      {state?.week_monday && (
        <p className="text-xs text-app-muted mb-3">
          Semana desde el {formatDate(state.week_monday)}
        </p>
      )}

      {isLoading && (
        <div className="h-24 animate-pulse rounded-xl bg-app-bg border border-app-border" />
      )}
      {isError && (
        <p className="text-sm text-app-muted">No se pudo cargar el objetivo semanal.</p>
      )}
      {!isLoading && !isError && state && (
        <>
          <div
            className="relative h-3.5 w-full overflow-hidden rounded-full border border-app-border"
            role="progressbar"
            aria-valuenow={Math.min(state.action_count, goal)}
            aria-valuemin={0}
            aria-valuemax={SEGMENTS}
            aria-label={`Progreso del objetivo semanal: ${state.action_count} de ${goal} acciones`}
          >
            <div className="absolute inset-0 bg-app-bg" />
            {count > 0 && (
              <div
                className={
                  count === SEGMENTS
                    ? 'absolute inset-y-0 left-0 overflow-hidden rounded-full'
                    : 'absolute inset-y-0 left-0 overflow-hidden rounded-l-full'
                }
                style={{ width: `${(count / SEGMENTS) * 100}%` }}
              >
                <div
                  className="absolute left-0 top-0 h-full w-full bg-gradient-to-r from-teal-400 via-cyan-500 to-violet-600"
                  style={{ width: `${(SEGMENTS / count) * 100}%` }}
                />
              </div>
            )}
            <div
              className="pointer-events-none absolute inset-0 flex"
              aria-hidden
            >
              {Array.from({ length: SEGMENTS }, (_, i) => (
                <div
                  key={i}
                  className={`min-w-0 flex-1 border-r border-app-surface last:border-r-0`}
                />
              ))}
            </div>
          </div>
          <p className="mt-2 text-center text-sm font-medium tabular-nums text-app-foreground">
            {state.action_count}/{goal} acciones
          </p>

          <div className="mt-5 flex flex-col items-center gap-2">
            {chestVariant === 'locked' && (
              <div className="rounded-full p-2 opacity-90" aria-hidden>
                <ChestClosedGrey />
              </div>
            )}
            {chestVariant === 'ready' && (
              <button
                type="button"
                onClick={openRewardModal}
                className="rounded-full p-2 shadow-[0_0_22px_rgba(251,191,36,0.55)] ring-2 ring-amber-400/75 transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-app-accent"
                aria-label="Reclamar recompensa semanal"
              >
                <ChestReadyGlow />
              </button>
            )}
            {chestVariant === 'open' && (
              <div
                className="rounded-full p-2 opacity-85"
                title="Ya has reclamado tu recompensa esta semana"
              >
                <ChestOpenMuted />
              </div>
            )}
            <p className="text-xs text-app-muted text-center max-w-xs">
              {chestVariant === 'locked' && 'Cofre disponible al completar las 4 acciones.'}
              {chestVariant === 'ready' && '¡Objetivo listo! Pulsa el cofre para reclamar tus puntos.'}
              {chestVariant === 'open' && 'Cofre abierto: ya recibiste tu parte de la recompensa.'}
            </p>
          </div>
        </>
      )}

      {rewardModal && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="presentation"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-app-border bg-app-surface p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="weekly-reward-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="weekly-reward-title"
              className="text-lg font-semibold text-app-foreground"
            >
              ¡Enhorabuena!
            </h3>
            <p className="mt-3 text-sm text-app-muted">
              Aquí tienes tu recompensa semanal:{' '}
              <span className="font-semibold text-app-foreground">+{reward} pts</span>.
            </p>
            {claimMutation.isError && (
              <p className="mt-2 text-sm text-red-600">
                {claimMutation.error instanceof Error
                  ? claimMutation.error.message
                  : 'No se pudo aplicar la recompensa'}
              </p>
            )}
            <div className="mt-6 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                type="button"
                onClick={closeModal}
                disabled={claimMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                type="button"
                onClick={handleAcceptReward}
                disabled={claimMutation.isPending}
              >
                {claimMutation.isPending ? 'Aplicando…' : 'Aceptar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
