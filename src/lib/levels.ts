/** Puntos “de por vida”: 100 iniciales + todo lo ganado (deltas positivos en historial). */

export const LEVEL_POINTS_STEP = 100

export function getLevelFromLifetime(lifetimePoints: number): number {
  if (lifetimePoints <= 0) return 1
  return 1 + Math.floor((lifetimePoints - 1) / LEVEL_POINTS_STEP)
}

export function getMedalLevelsUnlocked(currentLevel: number): number[] {
  if (currentLevel < 2) return []
  return Array.from({ length: currentLevel - 1 }, (_, i) => i + 2)
}

export function getLevelProgress(lifetimePoints: number): {
  level: number
  progressFraction: number
  pointsToNextLevel: number
} {
  const level = getLevelFromLifetime(lifetimePoints)
  const pointsIntoLevel = lifetimePoints - (level - 1) * LEVEL_POINTS_STEP
  const progressFraction = Math.min(
    1,
    Math.max(0, pointsIntoLevel / LEVEL_POINTS_STEP)
  )
  const nextThreshold = level * LEVEL_POINTS_STEP + 1
  const pointsToNextLevel = Math.max(0, nextThreshold - lifetimePoints)
  return { level, progressFraction, pointsToNextLevel }
}
