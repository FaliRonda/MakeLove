// Edge Function: envía Web Push cuando se inserta una notificación (invocada por Database Webhook)
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails('mailto:pinguslove@localhost', vapidPublic, vapidPrivate)
}

function displayUserName(user: { name?: string | null; email?: string | null } | null): string {
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

function displayActionName(action: { name?: string | null } | null): string {
  return action?.name?.trim() || 'Acción'
}

type RequestCtx = { requesterName: string; targetName: string; actionName: string }
type ClaimCtx = { claimerName: string; targetName: string; actionName: string; status?: string }

function notificationBody(type: string, request?: RequestCtx | null, claim?: ClaimCtx | null): string {
  switch (type) {
    case 'action_request':
      return request
        ? `${request.requesterName} te solicita «${request.actionName}»`
        : 'Nueva solicitud de acción'
    case 'request_accepted_pending':
      return request
        ? `${request.targetName} ha aceptado tu solicitud «${request.actionName}». Confírmala cuando la haya realizado.`
        : 'Tu solicitud fue aceptada. Confírmala cuando se haya realizado.'
    case 'request_confirmed_target':
      return request
        ? `${request.requesterName} ha confirmado la solicitud «${request.actionName}». Los puntos se han abonado.`
        : 'Han confirmado una solicitud que cumpliste. Los puntos se han abonado.'
    case 'request_rejected':
      return request
        ? `${request.targetName} ha rechazado tu solicitud «${request.actionName}». Has ganado 0,2× los puntos.`
        : 'Tu solicitud fue rechazada. Has ganado 0,2× los puntos.'
    case 'request_expired':
      return request
        ? `Tu solicitud «${request.actionName}» para ${request.targetName} ha caducado. Has ganado 0,2× los puntos.`
        : 'Tu solicitud ha caducado. Has ganado 0,2× los puntos.'
    case 'performed_for_request':
      if (claim) {
        return `${claim.claimerName} indica que te ha hecho «${claim.actionName}». ¿Confirmas o cancelas?`
      }
      return 'Nueva acción realizada hacia ti. ¿Confirmas o cancelas?'
    case 'performed_for_confirmed':
      return claim
        ? `${claim.targetName} ha confirmado «${claim.actionName}» que le indicaste. Has ganado 1,5× los puntos.`
        : 'Han confirmado una acción que registraste. Has ganado 1,5× los puntos.'
    case 'performed_for_cancelled':
      return claim
        ? `${claim.targetName} ha cancelado tu registro de «${claim.actionName}».`
        : 'Han cancelado tu registro de acción realizada.'
    case 'performed_for_you_confirmed':
      return claim
        ? `Has confirmado que ${claim.claimerName} te ha hecho «${claim.actionName}».`
        : 'Has confirmado una acción realizada hacia ti.'
    case 'performed_for_you_cancelled':
      return claim
        ? `Has cancelado el registro de que ${claim.claimerName} te hizo «${claim.actionName}».`
        : 'Has cancelado un registro de acción realizada hacia ti.'
    default:
      return 'Tienes una nueva notificación'
  }
}

const REQUEST_TYPES = new Set([
  'action_request',
  'request_accepted_pending',
  'request_confirmed_target',
  'request_rejected',
  'request_expired',
])

const CLAIM_TYPES = new Set([
  'performed_for_request',
  'performed_for_confirmed',
  'performed_for_cancelled',
  'performed_for_you_confirmed',
  'performed_for_you_cancelled',
])

async function loadRequestContext(
  supabase: SupabaseClient,
  requestId: string
): Promise<RequestCtx | null> {
  const { data: req, error } = await supabase
    .from('action_requests')
    .select('requester_id, target_user_id, action_type_id')
    .eq('id', requestId)
    .maybeSingle()
  if (error || !req) return null

  const [{ data: requester }, { data: target }, { data: action }] = await Promise.all([
    supabase.from('users').select('name, email').eq('id', req.requester_id).maybeSingle(),
    supabase.from('users').select('name, email').eq('id', req.target_user_id).maybeSingle(),
    supabase.from('action_types').select('name').eq('id', req.action_type_id).maybeSingle(),
  ])

  return {
    requesterName: displayUserName(requester),
    targetName: displayUserName(target),
    actionName: displayActionName(action),
  }
}

async function loadClaimContext(
  supabase: SupabaseClient,
  claimId: string
): Promise<ClaimCtx | null> {
  const { data: claim, error } = await supabase
    .from('action_claims')
    .select('claimer_id, target_user_id, action_type_id, status')
    .eq('id', claimId)
    .maybeSingle()
  if (error || !claim) return null

  const [{ data: claimer }, { data: target }, { data: action }] = await Promise.all([
    supabase.from('users').select('name, email').eq('id', claim.claimer_id).maybeSingle(),
    supabase.from('users').select('name, email').eq('id', claim.target_user_id).maybeSingle(),
    supabase.from('action_types').select('name').eq('id', claim.action_type_id).maybeSingle(),
  ])

  return {
    claimerName: displayUserName(claimer),
    targetName: displayUserName(target),
    actionName: displayActionName(action),
    status: claim.status ?? undefined,
  }
}

async function resolvePushBody(
  supabase: SupabaseClient,
  type: string,
  referenceId: string | null
): Promise<string> {
  if (!referenceId) {
    return notificationBody(type, null, null)
  }
  if (REQUEST_TYPES.has(type)) {
    const request = await loadRequestContext(supabase, referenceId)
    return notificationBody(type, request, null)
  }
  if (CLAIM_TYPES.has(type)) {
    const claim = await loadClaimContext(supabase, referenceId)
    return notificationBody(type, null, claim)
  }
  return notificationBody(type, null, null)
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: { id: string; user_id: string; type: string; reference_id: string | null; read: boolean; created_at: string }
  schema: string
}

Deno.serve(async (req: Request) => {
  try {
    const payload: WebhookPayload = await req.json()
    if (payload.type !== 'INSERT' || payload.table !== 'notifications') {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { user_id, type, reference_id } = payload.record
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const title = 'PingusLove'
    const body = await resolvePushBody(supabase, type, reference_id)

    const requestRelated = [
      'action_request',
      'request_rejected',
      'request_expired',
      'request_accepted_pending',
      'request_confirmed_target',
      'performed_for_request',
    ].includes(type)
    const openUrl = requestRelated ? '/requests' : '/notifications'

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user_id)

    if (error || !subs?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const payloadStr = JSON.stringify({ title, body, url: openUrl, tag: `n-${payload.record.id}` })
    let sent = 0
    const gone: string[] = []

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payloadStr
        )
        sent++
      } catch (e: unknown) {
        const err = e as { message?: string }
        const msg = String(err?.message ?? e)
        if (msg.includes('410') || msg.includes('Gone') || msg.includes('404')) {
          gone.push(sub.endpoint)
        }
      }
    }

    if (gone.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', gone)
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('send-push error:', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
