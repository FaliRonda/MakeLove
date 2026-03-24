import type { RequestStatus } from './database'

export type { RequestStatus }

export interface User {
  id: string
  name: string
  email: string
  points_balance: number
  /** Puntos ganados de por vida (incluye 100 iniciales y créditos del historial). */
  lifetime_points_earned?: number
  is_admin: boolean
  avatar_url: string | null
  estado: string | null
  created_at: string
  updated_at: string
}

export interface UserLevelMedal {
  user_id: string
  level: number
  redeemed_at: string
  note: string | null
  created_at: string
}

export interface ActionType {
  id: string
  name: string
  description: string
  points_value: number
  reward_percentage: number | null
  is_active: boolean
  created_at: string
}

export interface ActionRecord {
  id: string
  user_id: string
  action_type_id: string
  performed_at: string
  notes: string | null
  request_id?: string | null
  target_user_id?: string | null
  record_claim_id?: string | null
}

export interface ActionRequest {
  id: string
  requester_id: string
  target_user_id: string
  action_type_id: string
  status: RequestStatus
  points_cost: number
  reward_amount: number
  created_at: string
  expires_at: string
  responded_at: string | null
}

export interface Notification {
  id: string
  user_id: string
  type: string
  reference_id: string | null
  read: boolean
  created_at: string
}

export interface ActionRecordWithDetails extends ActionRecord {
  action_types?: ActionType | null
  users?: User | null
  target_user?: User | null
}

export type ClaimStatus = 'pending' | 'confirmed' | 'cancelled'

export interface ActionClaim {
  id: string
  claimer_id: string
  target_user_id: string
  action_type_id: string
  status: ClaimStatus
  notes: string | null
  created_at: string
  responded_at: string | null
}

export interface BalanceTransaction {
  id: string
  user_id: string
  balance_before: number
  delta: number
  balance_after: number
  event_type: string
  reference_id: string | null
  description: string | null
  created_at: string
}
