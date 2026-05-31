import { useQuery } from '@tanstack/react-query'
import { supabase, getRestHeaders } from '@/lib/supabase'
import type { Notification } from '@/types'
import { displayActionName, displayUserName } from '@/lib/notificationMessages'

const CLAIM_SELECT =
  'id,status,claimer:users!claimer_id(name,email),target:users!target_user_id(name,email),action_types(name)'
const REQUEST_SELECT =
  'id,requester:users!requester_id(name,email),target:users!target_user_id(name,email),action_types(name)'

export type ClaimEnrichment = { claimerName: string; targetName: string; actionName: string; status?: string }
export type RequestEnrichment = { requesterName: string; targetName: string; actionName: string }

function fetchClaims(ids: string[]): Promise<Record<string, ClaimEnrichment>> {
  if (ids.length === 0) return Promise.resolve({})
  const h = getRestHeaders()
  const inFilter = `id=in.(${ids.join(',')})`
  if (h) {
    return fetch(
      `${h.url}/rest/v1/action_claims?${inFilter}&select=${encodeURIComponent(CLAIM_SELECT)}`,
      { headers: { apikey: h.key, Authorization: `Bearer ${h.token}` } }
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: unknown[]) => {
        const map: Record<string, ClaimEnrichment> = {}
        for (const row of Array.isArray(rows) ? rows : []) {
          const r = row as {
            id?: string
            status?: string
            claimer?: { name?: string; email?: string }
            target?: { name?: string; email?: string }
            action_types?: { name?: string }
          }
          if (r?.id) {
            map[r.id] = {
              claimerName: displayUserName(r.claimer),
              targetName: displayUserName(r.target),
              actionName: displayActionName(r.action_types),
              status: r.status,
            }
          }
        }
        return map
      })
  }
  if (!supabase) return Promise.resolve({})
  return (async () => {
    const { data: rows, error } = await supabase
      .from('action_claims')
      .select(CLAIM_SELECT)
      .in('id', ids)
    if (error || !rows) return {}
    const map: Record<string, ClaimEnrichment> = {}
    for (const r of rows as {
      id: string
      status?: string
      claimer?: { name?: string; email?: string }
      target?: { name?: string; email?: string }
      action_types?: { name?: string }
    }[]) {
      map[r.id] = {
        claimerName: displayUserName(r.claimer),
        targetName: displayUserName(r.target),
        actionName: displayActionName(r.action_types),
        status: r.status,
      }
    }
    return map
  })()
}

function fetchRequests(ids: string[]): Promise<Record<string, RequestEnrichment>> {
  if (ids.length === 0) return Promise.resolve({})
  const h = getRestHeaders()
  const inFilter = `id=in.(${ids.join(',')})`
  if (h) {
    return fetch(
      `${h.url}/rest/v1/action_requests?${inFilter}&select=${encodeURIComponent(REQUEST_SELECT)}`,
      { headers: { apikey: h.key, Authorization: `Bearer ${h.token}` } }
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: unknown[]) => {
        const map: Record<string, RequestEnrichment> = {}
        for (const row of Array.isArray(rows) ? rows : []) {
          const r = row as {
            id?: string
            requester?: { name?: string; email?: string }
            target?: { name?: string; email?: string }
            action_types?: { name?: string }
          }
          if (r?.id) {
            map[r.id] = {
              requesterName: displayUserName(r.requester),
              targetName: displayUserName(r.target),
              actionName: displayActionName(r.action_types),
            }
          }
        }
        return map
      })
  }
  if (!supabase) return Promise.resolve({})
  return (async () => {
    const { data: rows, error } = await supabase
      .from('action_requests')
      .select(REQUEST_SELECT)
      .in('id', ids)
    if (error || !rows) return {}
    const map: Record<string, RequestEnrichment> = {}
    for (const r of rows as {
      id: string
      requester?: { name?: string; email?: string }
      target?: { name?: string; email?: string }
      action_types?: { name?: string }
    }[]) {
      map[r.id] = {
        requesterName: displayUserName(r.requester),
        targetName: displayUserName(r.target),
        actionName: displayActionName(r.action_types),
      }
    }
    return map
  })()
}

export function useNotificationEnrichment(notifications: Notification[]) {
  const claimIds = [...new Set(
    notifications
      .filter((n) => n.reference_id && [
        'performed_for_request', 'performed_for_confirmed', 'performed_for_cancelled',
        'performed_for_you_confirmed', 'performed_for_you_cancelled',
      ].includes(n.type))
      .map((n) => n.reference_id!)
  )]
  const requestRelatedTypes = [
    'action_request',
    'request_accepted_pending',
    'request_confirmed_target',
    'request_rejected',
    'request_expired',
  ]
  const requestIds = [...new Set(
    notifications
      .filter((n) => n.reference_id && requestRelatedTypes.includes(n.type))
      .map((n) => n.reference_id!)
  )]

  const { data: claimMap = {} } = useQuery({
    queryKey: ['notification-claims', claimIds.sort().join(',')],
    queryFn: () => fetchClaims(claimIds),
    enabled: claimIds.length > 0,
  })

  const { data: requestMap = {} } = useQuery({
    queryKey: ['notification-requests', requestIds.sort().join(',')],
    queryFn: () => fetchRequests(requestIds),
    enabled: requestIds.length > 0,
  })

  return { claimMap, requestMap }
}
