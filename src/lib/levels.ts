/** Puntos “de por vida”: 100 iniciales + créditos del historial.
 * Niveles por tramos de 100 desde 100: 100–199 → 1, 200–299 → 2, 300–399 → 3…
 * Subes de nivel al alcanzar 200, 300, 400…
 */

export const LEVEL_POINTS_STEP = 100
/** Primer total de puntos de vida que cuenta como nivel 1. */
export const LEVEL_BASE_POINTS = 100

export function getLevelFromLifetime(lifetimePoints: number): number {
  if (lifetimePoints < LEVEL_BASE_POINTS) return 1
  return (
    1 + Math.floor((lifetimePoints - LEVEL_BASE_POINTS) / LEVEL_POINTS_STEP)
  )
}

/** Inicio del tramo del nivel (100, 200, 300…). */
export function levelStartPoints(level: number): number {
  return LEVEL_BASE_POINTS + (level - 1) * LEVEL_POINTS_STEP
}

export function getMedalLevelsUnlocked(currentLevel: number): number[] {
  if (currentLevel < 2) return []
  return Array.from({ length: currentLevel - 1 }, (_, i) => i + 2)
}

export function getLevelProgress(lifetimePoints: number): {
  level: number
  progressFraction: number
  pointsToNextLevel: number
  /** Total de puntos de vida a partir del cual pasas al siguiente nivel (200, 300, 400…). */
  nextLevelAt: number
} {
  const level = getLevelFromLifetime(lifetimePoints)
  const start = levelStartPoints(level)
  const pointsIntoLevel = lifetimePoints - start
  const progressFraction = Math.min(
    1,
    Math.max(0, pointsIntoLevel / LEVEL_POINTS_STEP)
  )
  const nextLevelAt = start + LEVEL_POINTS_STEP
  const pointsToNextLevel = Math.max(0, nextLevelAt - lifetimePoints)
  return { level, progressFraction, pointsToNextLevel, nextLevelAt }
}
