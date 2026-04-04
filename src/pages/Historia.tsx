import { useMemo, useState } from 'react'
import {
  useActiveHistoriaState,
  useClaimHistoriaMissionReward,
  type HistoriaMissionRewardShopItem,
} from '@/hooks/useHistoria'
import { useUserInventory } from '@/hooks/useShop'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import { rewardShopItemToShopItem } from '@/lib/rewardShopItemToShopItem'
import { HistoriaSagaProgress } from '@/components/historia/HistoriaSagaProgress'
import { MissionRewardShopPreview } from '@/components/historia/MissionRewardShopPreview'
import { ShopItemDetailModal, type FramePreviewUser } from '@/components/shop/ShopItemDetailModal'
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
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-teal-400 via-cyan-500 to-violet-600 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function Historia() {
  const { profile, refetchProfile } = useAuth()
  const userId = profile?.id
  const { data: historiaState, isLoading, error } = useActiveHistoriaState(userId)
  const claimMutation = useClaimHistoriaMissionReward(userId)
  const [claimCelebration, setClaimCelebration] = useState<{
    piedritas: number
    shopItem: HistoriaMissionRewardShopItem | null
  } | null>(null)
  const [rewardDetailReward, setRewardDetailReward] = useState<HistoriaMissionRewardShopItem | null>(null)

  const { data: inventory = [] } = useUserInventory(userId)
  const inventoryByItemId = useMemo(() => new Map(inventory.map((i) => [i.item_id, i])), [inventory])

  const todayISO = useMemo(() => todayMadridISODate(), [])

  const framePreviewUser: FramePreviewUser | undefined = profile
    ? {
        avatarUrl: profile.avatar_url
          ? `${profile.avatar_url}?t=${encodeURIComponent(profile.updated_at ?? '')}`
          : null,
        name: profile.name?.trim() || 'Tú',
      }
    : undefined

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
                            {mission.reward_shop_item ? (
                              <MissionRewardShopPreview
                                reward={mission.reward_shop_item}
                                onOpenDetail={setRewardDetailReward}
                                extraPiedritas={
                                  mission.reward_piedritas > 0 ? mission.reward_piedritas : undefined
                                }
                                framePreviewUser={framePreviewUser}
                              />
                            ) : (
                              <span className="text-xs tabular-nums font-semibold text-app-accent">
                                +{mission.reward_piedritas} 💎
                              </span>
                            )}
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
                                      mission.target_type,
                                      Array.isArray(req.prior_mission_ids) && req.prior_mission_ids.length > 0
                                        ? req.prior_mission_ids.length
                                        : undefined
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
                            onClick={() => {
                              void claimMutation
                                .mutateAsync(mission.id)
                                .then(async (result) => {
                                  try {
                                    await refetchProfile()
                                  } finally {
                                    setClaimCelebration({
                                      piedritas: result.piedritas,
                                      shopItem: result.shop_item,
                                    })
                                  }
                                })
                                .catch(() => {
                                  /* error ya manejable vía UI del botón / futuro toast */
                                })
                            }}
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

      {rewardDetailReward && userId && (
        <ShopItemDetailModal
          item={rewardShopItemToShopItem(rewardDetailReward)}
          inventoryItem={inventoryByItemId.get(rewardDetailReward.id)}
          userId={userId}
          balance={profile?.piedritas_balance ?? 0}
          framePreviewUser={framePreviewUser}
          onClose={() => setRewardDetailReward(null)}
          refetchProfile={refetchProfile}
          onPurchaseSuccess={() => setRewardDetailReward(null)}
        />
      )}

      {claimCelebration && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="presentation"
          onClick={() => setClaimCelebration(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-app-border bg-app-surface p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="piedritas-claim-title"
            onClick={(e) => e.stopPropagation()}
          >
            <style>{`
              @keyframes historiaPiedritasShine {
                0%, 100% {
                  filter: drop-shadow(0 0 10px rgba(244, 114, 182, 0.85)) drop-shadow(0 0 24px rgba(251, 191, 36, 0.45));
                  transform: scale(1) rotate(-2deg);
                }
                50% {
                  filter: drop-shadow(0 0 22px rgba(251, 191, 36, 0.95)) drop-shadow(0 0 48px rgba(236, 72, 153, 0.55));
                  transform: scale(1.12) rotate(2deg);
                }
              }
            `}</style>
            <div className="flex flex-col items-center text-center">
              {claimCelebration.shopItem ? (
                <div
                  className="text-6xl leading-none select-none"
                  style={{ animation: 'historiaPiedritasShine 2s ease-in-out infinite' }}
                  aria-hidden
                >
                  {claimCelebration.shopItem.badge_symbol ?? '🏅'}
                </div>
              ) : (
                <div
                  className="text-6xl leading-none select-none"
                  style={{ animation: 'historiaPiedritasShine 2s ease-in-out infinite' }}
                  aria-hidden
                >
                  💎
                </div>
              )}
              <h3 id="piedritas-claim-title" className="mt-4 text-lg font-semibold text-app-foreground">
                ¡Enhorabuena!
              </h3>
              {claimCelebration.shopItem ? (
                <p className="mt-2 text-sm text-app-muted">
                  Has reclamado{' '}
                  <span className="font-semibold text-app-foreground">{claimCelebration.shopItem.name}</span>
                  . Ya está en tu inventario para equipar cuando quieras.
                </p>
              ) : (
                <p className="mt-2 text-sm text-app-muted">
                  Has conseguido{' '}
                  <span className="font-semibold tabular-nums text-app-accent">
                    +{claimCelebration.piedritas}{' '}
                    {claimCelebration.piedritas === 1 ? 'piedrita' : 'piedritas'}
                  </span>
                  .
                </p>
              )}
              {!claimCelebration.shopItem && claimCelebration.piedritas === 0 ? (
                <p className="mt-1 text-xs text-app-muted">
                  Esta misión no suma piedritas a tu saldo (recompensa 0).
                </p>
              ) : null}
              {!claimCelebration.shopItem && claimCelebration.piedritas > 0 ? (
                <p className="mt-1 text-xs text-app-muted">
                  Ya están en tu saldo; úsalas en la tienda cuando quieras.
                </p>
              ) : null}
              {claimCelebration.shopItem && claimCelebration.piedritas > 0 ? (
                <p className="mt-1 text-xs text-app-muted tabular-nums">
                  Además: +{claimCelebration.piedritas}{' '}
                  {claimCelebration.piedritas === 1 ? 'piedrita' : 'piedritas'}.
                </p>
              ) : null}
              <Button className="mt-6 w-full" type="button" onClick={() => setClaimCelebration(null)}>
                Aceptar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
