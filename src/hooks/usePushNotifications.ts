import { useEffect, useRef, useState } from 'react'
import { supabase, getRestHeaders } from '@/lib/supabase'

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(base64.replace(/-/g, '+').replace(/_/g, '/') + padding)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function usePushNotifications(userId: string | undefined) {
  const [status, setStatus] = useState<'idle' | 'unsupported' | 'permission-denied' | 'subscribed' | 'error'>('idle')
  const doneRef = useRef(false)

  useEffect(() => {
    if (!userId || !VAPID_PUBLIC?.trim()) {
      if (!VAPID_PUBLIC?.trim()) setStatus('unsupported')
      return
    }

    let cancelled = false

    const run = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setStatus('unsupported')
        return
      }

      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        await reg.update()

        if (!('Notification' in window)) {
          setStatus('unsupported')
          return
        }
        let permission = Notification.permission
        if (permission === 'default') {
          permission = await Notification.requestPermission()
        }
        if (permission !== 'granted') {
          setStatus(permission === 'denied' ? 'permission-denied' : 'unsupported')
          return
        }

        let sub = await reg.pushManager.getSubscription()
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
          })
        }

        const subscription = sub.toJSON()
        const endpoint = subscription.endpoint
        const keys = subscription.keys
        if (!endpoint || !keys?.p256dh || !keys?.auth) {
          setStatus('error')
          return
        }

        const h = getRestHeaders()
        if (h) {
          const res = await fetch(`${h.url}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: h.key,
              Authorization: `Bearer ${h.token}`,
              Prefer: 'resolution=merge-duplicates',
            },
            body: JSON.stringify({
              user_id: userId,
              endpoint,
              p256dh: keys.p256dh,
              auth: keys.auth,
            }),
          })
          if (!res.ok && res.status !== 409) {
            setStatus('error')
            return
          }
        } else if (supabase) {
          const { error } = await supabase.from('push_subscriptions').upsert(
            {
              user_id: userId,
              endpoint,
              p256dh: keys.p256dh,
              auth: keys.auth,
            },
            { onConflict: 'endpoint' }
          )
          if (error) {
            setStatus('error')
            return
          }
        }

        if (!cancelled) setStatus('subscribed')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    if (!doneRef.current) {
      doneRef.current = true
      run()
    }

    return () => {
      cancelled = true
    }
  }, [userId])

  const requestPermission = async () => {
    if (!('Notification' in window)) return
    const permission = await Notification.requestPermission()
    if (permission === 'granted') doneRef.current = false
  }

  return { status, requestPermission }
}
