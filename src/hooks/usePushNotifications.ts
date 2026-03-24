import { useEffect, useState, useCallback } from 'react'
import { supabase, getRestHeaders } from '@/lib/supabase'

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

/** Evita volver a suscribir automáticamente tras desactivar desde el perfil. */
const PUSH_OPT_OUT_KEY = 'makelove_push_opt_out'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(base64.replace(/-/g, '+').replace(/_/g, '/') + padding)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function usePushNotifications(userId: string | undefined) {
  const [status, setStatus] = useState<'idle' | 'unsupported' | 'vapid-missing' | 'permission-denied' | 'subscribed' | 'error'>('idle')
  const [isRegistering, setIsRegistering] = useState(false)

  const doRegister = useCallback(async () => {
    if (!userId || !VAPID_PUBLIC?.trim()) {
      if (!VAPID_PUBLIC?.trim()) setStatus('vapid-missing')
      return
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    if (!('Notification' in window)) {
      setStatus('unsupported')
      return
    }

    setIsRegistering(true)
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await reg.update()

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

      setStatus('subscribed')
      try {
        localStorage.removeItem(PUSH_OPT_OUT_KEY)
      } catch {
        /* ignore */
      }
    } catch {
      setStatus('error')
    } finally {
      setIsRegistering(false)
    }
  }, [userId])

  const unregisterPush = useCallback(async () => {
    if (!userId) return
    setIsRegistering(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = reg ? await reg.pushManager.getSubscription() : null
      const endpoint = sub?.endpoint ?? null
      if (sub) await sub.unsubscribe()
      if (endpoint) {
        const h = getRestHeaders()
        if (h) {
          const res = await fetch(
            `${h.url}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
            { method: 'DELETE', headers: { apikey: h.key, Authorization: `Bearer ${h.token}` } }
          )
          if (!res.ok) {
            setStatus('error')
            return
          }
        } else if (supabase) {
          const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
          if (error) {
            setStatus('error')
            return
          }
        }
      }
      try {
        localStorage.setItem(PUSH_OPT_OUT_KEY, '1')
      } catch {
        /* ignore */
      }
      setStatus('idle')
    } catch {
      setStatus('error')
    } finally {
      setIsRegistering(false)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setStatus('idle')
      return
    }
    if (!VAPID_PUBLIC?.trim()) {
      setStatus('vapid-missing')
      return
    }
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }

    let cancelled = false

    const sync = async () => {
      if (Notification.permission === 'denied') {
        if (!cancelled) setStatus('permission-denied')
        return
      }
      if (Notification.permission === 'default') {
        if (!cancelled) setStatus('idle')
        return
      }

      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        await reg.update()
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          if (!cancelled) {
            setStatus('subscribed')
            try {
              localStorage.removeItem(PUSH_OPT_OUT_KEY)
            } catch {
              /* ignore */
            }
          }
          return
        }

        let optedOut = false
        try {
          optedOut = localStorage.getItem(PUSH_OPT_OUT_KEY) === '1'
        } catch {
          optedOut = false
        }
        if (optedOut) {
          if (!cancelled) setStatus('idle')
          return
        }

        await doRegister()
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void sync()
    return () => {
      cancelled = true
    }
  }, [userId, doRegister])

  return { status, isRegistering, registerPush: doRegister, unregisterPush }
}
