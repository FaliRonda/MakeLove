export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          email: string
          points_balance: number
          is_admin: boolean
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          email: string
          points_balance?: number
          is_admin?: boolean
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          points_balance?: number
          is_admin?: boolean
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      action_types: {
        Row: {
          id: string
          name: string
          description: string
          points_value: number
          reward_percentage: number | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string
          points_value: number
          reward_percentage?: number | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          points_value?: number
          reward_percentage?: number | null
          is_active?: boolean
          created_at?: string
        }
      }
      action_records: {
        Row: {
          id: string
          user_id: string
          action_type_id: string
          performed_at: string
          notes: string | null
          request_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          action_type_id: string
          performed_at?: string
          notes?: string | null
          request_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          action_type_id?: string
          performed_at?: string
          notes?: string | null
          request_id?: string | null
        }
      }
      action_requests: {
        Row: {
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
        Insert: {
          id?: string
          requester_id: string
          target_user_id: string
          action_type_id: string
          status?: RequestStatus
          points_cost: number
          reward_amount: number
          created_at?: string
          expires_at: string
          responded_at?: string | null
        }
        Update: {
          id?: string
          requester_id?: string
          target_user_id?: string
          action_type_id?: string
          status?: RequestStatus
          points_cost?: number
          reward_amount?: number
          created_at?: string
          expires_at?: string
          responded_at?: string | null
        }
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          reference_id: string | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          reference_id?: string | null
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          reference_id?: string | null
          read?: boolean
          created_at?: string
        }
      }
      global_config: {
        Row: { key: string; value: string }
        Insert: { key: string; value: string }
        Update: { key?: string; value?: string }
      }
    }
    Functions: {
      mark_action_done: { Args: { p_action_type_id: string; p_notes?: string }; Returns: string }
      expire_pending_requests: { Args: Record<string, never>; Returns: number }
      accept_request: { Args: { p_request_id: string }; Returns: void }
      reject_request: { Args: { p_request_id: string }; Returns: void }
      create_action_request: { Args: { p_target_user_id: string; p_action_type_id: string }; Returns: string }
      cancel_request: { Args: { p_request_id: string }; Returns: void }
    }
  }
}
