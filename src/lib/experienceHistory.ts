import type { BalanceTransaction } from '@/types'

/**
 * Para cada movimiento (orden más reciente primero), la experiencia acumulada
 * justo después de aplicar ese movimiento. `currentExperience` debe ser la
 * experiencia actual del usuario (p. ej. users.lifetime_points_earned).
 */
export function experienceAfterTransactionsDesc(
  transactionsNewestFirst: Pick<BalanceTransaction, 'delta'>[],
  currentExperience: number
): number[] {
  let exp = currentExperience
  return transactionsNewestFirst.map((t) => {
    const value = exp
    if (t.delta > 0) exp -= t.delta
    return value
  })
}

export function experienceByTransactionId(
  transactionsNewestFirst: BalanceTransaction[],
  currentExperience: number
): Map<string, number> {
  const values = experienceAfterTransactionsDesc(
    transactionsNewestFirst,
    currentExperience
  )
  const map = new Map<string, number>()
  transactionsNewestFirst.forEach((t, i) => map.set(t.id, values[i]))
  return map
}
