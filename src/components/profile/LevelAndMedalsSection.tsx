import { useState } from 'react'
import {
  getLevelProgress,
  getMedalLevelsUnlocked,
  LEVEL_POINTS_STEP,
} from '@/lib/levels'
import { formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { useLevelMedals, useRedeemLevelMedal } from '@/hooks/useLevelMedals'
import type { UserLevelMedal } from '@/types'

type MedalDialog =
  | null
  | {
      level: number
      mode: 'redeem' | 'detail'
      medal?: UserLevelMedal
    }

function medalMap(rows: UserLevelMedal[]): Map<number, UserLevelMedal> {
  return new Map(rows.map((r) => [r.level, r]))
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  )
}

export function LevelAndMedalsSection({
  userId,
  lifetimePoints,
  isOwnProfile,
}: {
  userId: string
  lifetimePoints: number
  isOwnProfile: boolean
}) {
  const { data: medalRows = [] } = useLevelMedals(userId)
  const redeemMutation = useRedeemLevelMedal()
  const [dialog, setDialog] = useState<MedalDialog>(null)
  const [redeemNote, setRedeemNote] = useState('')

  const { level, progressFraction, pointsToNextLevel } =
    getLevelProgress(lifetimePoints)
  const medalLevels = getMedalLevelsUnlocked(level)
  const mMap = medalMap(medalRows)

  const openMedal = (medalLevel: number) => {
    const row = mMap.get(medalLevel)
    if (row) {
      setDialog({ level: medalLevel, mode: 'detail', medal: row })
      return
    }
    if (!isOwnProfile) return
    setRedeemNote('')
    setDialog({ level: medalLevel, mode: 'redeem' })
  }

  const closeDialog = () => {
    setDialog(null)
    setRedeemNote('')
    redeemMutation.reset()
  }

  const confirmRedeem = async () => {
    if (!dialog || dialog.mode !== 'redeem') return
    try {
      await redeemMutation.mutateAsync({
        userId,
        level: dialog.level,
        note: redeemNote || null,
      })
      closeDialog()
    } catch {
      /* error surfaced via mutation state if needed */
    }
  }

  const pct = Math.round(progressFraction * 100)

  return (
    <div className="mt-6 pt-6 border-t border-app-border space-y-5">
      <div>
        <h3 className="text-sm font-medium text-app-foreground mb-3">
          Nivel y progreso
        </h3>
        <div className="relative pt-5 pb-1">
          <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 px-3 py-0.5 rounded-full bg-app-surface border border-app-border shadow-sm">
            <span className="text-sm font-semibold text-app-foreground tabular-nums">
              Nivel {level}
            </span>
          </div>
          <div
            className="h-3 w-full rounded-full bg-app-bg border border-app-border overflow-hidden mt-1"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progreso hacia el nivel ${level + 1}`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-app-accent to-rose-400 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <p className="text-sm text-app-muted text-center mt-2">
          {pointsToNextLevel === 0 ? (
            <>Has alcanzado el umbral del siguiente nivel.</>
          ) : (
            <>
              Te faltan{' '}
              <span className="font-semibold text-app-foreground tabular-nums">
                {pointsToNextLevel}
              </span>{' '}
              punto{pointsToNextLevel !== 1 ? 's' : ''} para el nivel{' '}
              {level + 1}{' '}
              <span className="text-app-muted">
                (cada {LEVEL_POINTS_STEP} puntos de vida subes un nivel)
              </span>
            </>
          )}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-medium text-app-foreground mb-3">
          Medallas
        </h3>
        <p className="text-xs text-app-muted mb-3">
          Cada medalla es la recompensa por subir a ese nivel; canjéala con tu
          pareja y márcala aquí cuando la hayáis disfrutado fuera de la app.
        </p>
        {medalLevels.length === 0 ? (
          <p className="text-sm text-app-muted">
            El nivel 1 no incluye medalla. Sigue ganando puntos de vida para
            desbloquear la primera.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-4 justify-center sm:justify-start">
            {medalLevels.map((lv) => {
              const row = mMap.get(lv)
              const redeemed = !!row
              const interactive = isOwnProfile || redeemed
              return (
                <li key={lv} className="flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!interactive}
                    onClick={() => interactive && openMedal(lv)}
                    title={
                      redeemed
                        ? `Medalla nivel ${lv}${redeemed ? ' · Canjeada' : ''}`
                        : isOwnProfile
                          ? `Medalla nivel ${lv} · Pulsa para marcar como canjeada`
                          : `Medalla nivel ${lv}`
                    }
                    className={[
                      'relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                      'bg-gradient-to-b from-[#d4a574] to-[#8b5a2b] border-[#5c3d1e]',
                      redeemed
                        ? 'shadow-[0_0_22px_rgba(251,191,36,0.55)] ring-2 ring-amber-400/70'
                        : 'opacity-95',
                      interactive
                        ? 'cursor-pointer hover:scale-105 active:scale-95'
                        : 'cursor-default opacity-80',
                    ].join(' ')}
                  >
                    <HeartIcon className="h-7 w-7 text-[#3d2010]" />
                  </button>
                  <span className="text-xs text-app-muted tabular-nums">
                    Nv. {lv}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {dialog?.mode === 'redeem' && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={closeDialog}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-app-surface border border-app-border p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="medal-redeem-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h4
              id="medal-redeem-title"
              className="text-lg font-semibold text-app-foreground"
            >
              Medalla nivel {dialog.level}
            </h4>
            <p className="text-sm text-app-muted mt-2">
              ¿Ya has canjeado esta recompensa con tu pareja? Confirma para
              guardar la fecha y una nota opcional.
            </p>
            <label className="block mt-4 text-sm font-medium text-app-foreground">
              Nota (opcional)
              <textarea
                value={redeemNote}
                onChange={(e) => setRedeemNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Ej.: Cena el sábado, masaje..."
                className="mt-1 w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-app-foreground placeholder:text-app-muted focus:border-app-accent focus:outline-none focus:ring-1 focus:ring-app-accent resize-none"
              />
            </label>
            {redeemMutation.isError && (
              <p className="text-sm text-red-600 mt-2">
                {redeemMutation.error instanceof Error
                  ? redeemMutation.error.message
                  : 'No se pudo guardar'}
              </p>
            )}
            <div className="flex gap-2 mt-5">
              <Button
                variant="outline"
                className="flex-1"
                type="button"
                onClick={closeDialog}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                type="button"
                onClick={() => void confirmRedeem()}
                disabled={redeemMutation.isPending}
              >
                {redeemMutation.isPending ? 'Guardando…' : 'Confirmar canje'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {dialog?.mode === 'detail' && dialog.medal && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={closeDialog}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-app-surface border border-app-border p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="medal-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h4
              id="medal-detail-title"
              className="text-lg font-semibold text-app-foreground"
            >
              Medalla nivel {dialog.level}
            </h4>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-app-muted">Canjeada el</dt>
                <dd className="font-medium text-app-foreground">
                  {formatDateTime(dialog.medal.redeemed_at)}
                </dd>
              </div>
              <div>
                <dt className="text-app-muted">Nota</dt>
                <dd className="text-app-foreground whitespace-pre-wrap">
                  {dialog.medal.note?.trim()
                    ? dialog.medal.note
                    : '—'}
                </dd>
              </div>
            </dl>
            <Button
              variant="outline"
              className="mt-6 w-full"
              type="button"
              onClick={closeDialog}
            >
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
