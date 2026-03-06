// Edge Function: envía Web Push cuando se inserta una notificación (invocada por Database Webhook)
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails('mailto:pinguslove@localhost', vapidPublic, vapidPrivate)
}

function messageForType(type: string): { title: string; body: string } {
  switch (type) {
    case 'action_request':
      return { title: 'PingusLove', body: 'Nueva solicitud de acción' }
    case 'performed_for_request':
      return { title: 'PingusLove', body: 'Alguien indica que ha realizado una acción hacia ti. ¿Confirmas o cancelas?' }
    case 'performed_for_confirmed':
      return { title: 'PingusLove', body: 'Alguien ha confirmado que realizaste una acción. Has ganado 1.5× los puntos.' }
    case 'performed_for_cancelled':
      return { title: 'PingusLove', body: 'Alguien ha cancelado tu registro de acción realizada.' }
    case 'request_rejected':
      return { title: 'PingusLove', body: 'La solicitud fue rechazada. Has ganado 0.2× los puntos.' }
    case 'request_expired':
      return { title: 'PingusLove', body: 'La solicitud ha caducado. Has ganado 0.2× los puntos.' }
    default:
      return { title: 'PingusLove', body: 'Tienes una nueva notificación' }
  }
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

    const { user_id, type } = payload.record
    const { title, body } = messageForType(type)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user_id)

    if (error || !subs?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const payloadStr = JSON.stringify({ title, body, url: '/notifications', tag: `n-${payload.record.id}` })
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
        const msg = String(e?.message ?? e)
        if (msg.includes('410') || msg.includes('Gone') || msg.includes('404')) {
          gone.push(sub.endpoint)
        }
      }
    }

    if (gone.length > 0 && supabase) {
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
