import type { RequestStatus } from './database'

export type { RequestStatus }

export interface User {
  id: string
  name: string
  email: string
  points_balance: number
  piedritas_balance?: number
  /** Puntos ganados de por vida (incluye 100 iniciales y créditos del historial). */
  lifetime_points_earned?: number
  is_admin: boolean
  avatar_url: string | null
  estado: string | null
  equipped_name_color?: string | null
  equipped_badge?: string | null
  /** URL del overlay de marco (tienda avatar_frame). */
  equipped_avatar_frame_url?: string | null
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

export interface WeeklyCollabGoalState {
  week_monday: string
  action_count: number
  goal: number
  reward_points: number
  claimed: boolean
  can_claim: boolean
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
  /** Momento en que el solicitante confirmó la realización y se movieron los puntos. */
  confirmed_at?: string | null
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

export type ShopItemType = 'name_color' | 'badge' | 'medal' | 'avatar_frame'

export interface ShopItem {
  id: string
  name: string
  description: string
  item_type: ShopItemType
  color_value: string | null
  badge_symbol: string | null
  frame_overlay_url: string | null
  cost_piedritas: number
  is_temporary: boolean
  available_until: string | null
  is_couple_item: boolean
  is_purchasable: boolean
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface UserInventoryItem {
  id: string
  user_id: string
  item_id: string
  acquired_at: string
  expires_at: string | null
  is_equipped: boolean
  name: string
  description: string
  item_type: ShopItemType
  color_value: string | null
  badge_symbol: string | null
  frame_overlay_url: string | null
  is_temporary: boolean
  is_couple_item: boolean
}
