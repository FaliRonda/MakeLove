/** Nombre visible para notificaciones (push e in-app). */
export function displayUserName(user: { name?: string | null; email?: string | null } | null | undefined): string {
  const n = user?.name?.trim()
  if (n) return n
  const e = user?.email?.trim()
  if (e) {
    const local = e.split('@')[0]?.trim()
    if (local) return local
    return e
  }
  return 'Usuario'
}

export function displayActionName(action: { name?: string | null } | null | undefined): string {
  const n = action?.name?.trim()
  return n || 'Acción'
}

export type RequestNotificationContext = {
  requesterName: string
  targetName: string
  actionName: string
}

export type ClaimNotificationContext = {
  claimerName: string
  targetName: string
  actionName: string
  status?: string
}

/** Cuerpo del mensaje según tipo; requiere contexto cuando hay reference_id. */
export function notificationBody(
  type: string,
  request?: RequestNotificationContext | null,
  claim?: ClaimNotificationContext | null
): string {
  switch (type) {
    case 'action_request':
      if (request) {
        return `${request.requesterName} te solicita «${request.actionName}»`
      }
      return 'Nueva solicitud de acción'

    case 'request_accepted_pending':
      if (request) {
        return `${request.targetName} ha aceptado tu solicitud «${request.actionName}». Confírmala en Solicitudes cuando la haya realizado.`
      }
      return 'Tu solicitud fue aceptada. Confírmala en Solicitudes cuando se haya realizado.'

    case 'request_confirmed_target':
      if (request) {
        return `${request.requesterName} ha confirmado la solicitud «${request.actionName}». Los puntos se han abonado.`
      }
      return 'Han confirmado una solicitud que cumpliste. Los puntos se han abonado.'

    case 'request_rejected':
      if (request) {
        return `${request.targetName} ha rechazado tu solicitud «${request.actionName}». Has ganado 0,2× los puntos.`
      }
      return 'Tu solicitud fue rechazada. Has ganado 0,2× los puntos.'

    case 'request_expired':
      if (request) {
        return `Tu solicitud «${request.actionName}» para ${request.targetName} ha caducado. Has ganado 0,2× los puntos.`
      }
      return 'Tu solicitud ha caducado. Has ganado 0,2× los puntos.'

    case 'performed_for_request':
      if (claim) {
        if (claim.status === 'confirmed') {
          return `Has confirmado que ${claim.claimerName} te ha hecho «${claim.actionName}».`
        }
        if (claim.status === 'cancelled') {
          return `Has cancelado el registro de que ${claim.claimerName} te hizo «${claim.actionName}».`
        }
        return `${claim.claimerName} indica que te ha hecho «${claim.actionName}». ¿Confirmas o cancelas?`
      }
      return 'Alguien indica que ha realizado una acción hacia ti. ¿Confirmas o cancelas?'

    case 'performed_for_confirmed':
      if (claim) {
        return `${claim.targetName} ha confirmado «${claim.actionName}» que le indicaste. Has ganado 1,5× los puntos.`
      }
      return 'Han confirmado una acción que registraste. Has ganado 1,5× los puntos.'

    case 'performed_for_cancelled':
      if (claim) {
        return `${claim.targetName} ha cancelado tu registro de «${claim.actionName}» hacia esa persona.`
      }
      return 'Han cancelado tu registro de acción realizada.'

    case 'performed_for_you_confirmed':
      if (claim) {
        return `Has confirmado que ${claim.claimerName} te ha hecho «${claim.actionName}».`
      }
      return 'Has confirmado una acción realizada hacia ti.'

    case 'performed_for_you_cancelled':
      if (claim) {
        return `Has cancelado el registro de que ${claim.claimerName} te hizo «${claim.actionName}».`
      }
      return 'Has cancelado un registro de acción realizada hacia ti.'

    default:
      return 'Tienes una nueva notificación'
  }
}
