import type { ReactNode } from 'react'

export type MissionMetricType =
  | 'actions_done'
  | 'requests_sent_confirmed'
  | 'requests_received_confirmed'
  | 'points_gained'
  | 'levels_gained'
  | 'prior_missions_complete'

function nStrong(n: number): ReactNode {
  return <span className="font-semibold text-app-accent tabular-nums">{n}</span>
}

/** Frases de objetivo alineadas con los tipos de métrica del backend. */
export function missionObjectiveLine(
  metricType: MissionMetricType,
  amount: number,
  targetType: 'individual' | 'couple',
  priorPoolSize?: number
): ReactNode {
  const n = nStrong(amount)
  const pool = priorPoolSize ?? amount

  switch (metricType) {
    case 'actions_done':
      if (targetType === 'couple') {
        return (
          <>
            Entre tú y tu pareja, registrad {n} {amount === 1 ? 'acción' : 'acciones'} como realizadas
            durante la historia
          </>
        )
      }
      return (
        <>
          Marca {n} {amount === 1 ? 'acción' : 'acciones'} como {amount === 1 ? 'realizada' : 'realizadas'}{' '}
          durante la historia
        </>
      )
    case 'requests_sent_confirmed':
      if (targetType === 'couple') {
        return (
          <>
            Enviad {n} solicitud{amount === 1 ? '' : 'es'} que {amount === 1 ? 'sea' : 'sean'} confirmada
            {amount === 1 ? '' : 's'} por la pareja durante la historia
          </>
        )
      }
      return (
        <>
          Envía {n} solicitud{amount === 1 ? '' : 'es'} que tu pareja confirme durante la historia
        </>
      )
    case 'requests_received_confirmed':
      if (targetType === 'couple') {
        return (
          <>
            Recibid {n} solicitud{amount === 1 ? '' : 'es'} confirmada{amount === 1 ? '' : 's'} durante la
            historia
          </>
        )
      }
      return (
        <>
          Recibe {n} solicitud{amount === 1 ? '' : 'es'} confirmada{amount === 1 ? '' : 's'} durante la
          historia
        </>
      )
    case 'points_gained':
      return <>Gana {n} punt{amount === 1 ? 'o' : 'os'} durante el periodo del capítulo</>
    case 'levels_gained':
      return <>Sube {n} nivel{amount === 1 ? '' : 'es'} durante el periodo del capítulo</>
    case 'prior_missions_complete':
      if (targetType === 'couple') {
        return (
          <>
            Completad al menos {n} de las {pool} misiones previas de esta historia (cada una con su objetivo
            cumplido)
          </>
        )
      }
      return (
        <>
          Completa al menos {n} de las {pool} misiones previas de esta historia (cada una con su objetivo
          cumplido)
        </>
      )
    default:
      return (
        <>
          Completa el objetivo de la misión: {n} unidad{amount === 1 ? '' : 'es'}
        </>
      )
  }
}
