// Generated Supabase Database types — DO NOT EDIT BY HAND.
//
// Source of truth: supabase/schema.sql. Regenerate after any schema change:
//   npm run db:start && npm run db:types
// (Generated with the same postgres-meta typegen the Supabase CLI uses.)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      availability: {
        Row: {
          available_after: string | null
          available_until: string | null
          comment: string | null
          created_at: string | null
          date: string
          game_id: string
          id: string
          status: Database["public"]["Enums"]["availability_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          available_after?: string | null
          available_until?: string | null
          comment?: string | null
          created_at?: string | null
          date: string
          game_id: string
          id?: string
          status?: Database["public"]["Enums"]["availability_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          available_after?: string | null
          available_until?: string | null
          comment?: string | null
          created_at?: string | null
          date?: string
          game_id?: string
          id?: string
          status?: Database["public"]["Enums"]["availability_status"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      game_memberships: {
        Row: {
          game_id: string
          id: string
          is_co_gm: boolean
          joined_at: string | null
          user_id: string
        }
        Insert: {
          game_id: string
          id?: string
          is_co_gm?: boolean
          joined_at?: string | null
          user_id: string
        }
        Update: {
          game_id?: string
          id?: string
          is_co_gm?: boolean
          joined_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_memberships_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      game_play_dates: {
        Row: {
          created_at: string | null
          date: string
          game_id: string
          id: string
          note: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          game_id: string
          id?: string
          note?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          game_id?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_play_dates_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          ad_hoc_only: boolean
          campaign_end_date: string | null
          campaign_start_date: string | null
          created_at: string | null
          default_end_time: string | null
          default_start_time: string | null
          description: string | null
          gm_id: string
          id: string
          invite_code: string
          min_players_needed: number | null
          name: string
          play_days: number[]
          scheduling_window_months: number | null
          timezone: string | null
        }
        Insert: {
          ad_hoc_only?: boolean
          campaign_end_date?: string | null
          campaign_start_date?: string | null
          created_at?: string | null
          default_end_time?: string | null
          default_start_time?: string | null
          description?: string | null
          gm_id: string
          id?: string
          invite_code: string
          min_players_needed?: number | null
          name: string
          play_days?: number[]
          scheduling_window_months?: number | null
          timezone?: string | null
        }
        Update: {
          ad_hoc_only?: boolean
          campaign_end_date?: string | null
          campaign_start_date?: string | null
          created_at?: string | null
          default_end_time?: string | null
          default_start_time?: string | null
          description?: string | null
          gm_id?: string
          id?: string
          invite_code?: string
          min_players_needed?: number | null
          name?: string
          play_days?: number[]
          scheduling_window_months?: number | null
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_gm_id_fkey"
            columns: ["gm_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          confirmed_by: string | null
          created_at: string | null
          date: string
          end_time: string | null
          game_id: string
          id: string
          location: string | null
          notes: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["session_status"] | null
        }
        Insert: {
          confirmed_by?: string | null
          created_at?: string | null
          date: string
          end_time?: string | null
          game_id: string
          id?: string
          location?: string | null
          notes?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["session_status"] | null
        }
        Update: {
          confirmed_by?: string | null
          created_at?: string | null
          date?: string
          end_time?: string | null
          game_id?: string
          id?: string
          location?: string | null
          notes?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["session_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      user_availability_defaults: {
        Row: {
          available_after: string | null
          available_until: string | null
          comment: string | null
          created_at: string | null
          day_of_week: number
          id: string
          status: Database["public"]["Enums"]["availability_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          available_after?: string | null
          available_until?: string | null
          comment?: string | null
          created_at?: string | null
          day_of_week: number
          id?: string
          status: Database["public"]["Enums"]["availability_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          available_after?: string | null
          available_until?: string | null
          comment?: string | null
          created_at?: string | null
          day_of_week?: number
          id?: string
          status?: Database["public"]["Enums"]["availability_status"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_availability_defaults_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          id: string
          is_admin: boolean | null
          is_gm: boolean | null
          name: string
          time_format: string | null
          timezone: string | null
          week_start_day: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          id: string
          is_admin?: boolean | null
          is_gm?: boolean | null
          name: string
          time_format?: string | null
          timezone?: string | null
          week_start_day?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          id?: string
          is_admin?: boolean | null
          is_gm?: boolean | null
          name?: string
          time_format?: string | null
          timezone?: string | null
          week_start_day?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_future_sessions: {
        Args: { game_id_param: string }
        Returns: number
      }
      count_game_players: { Args: { game_id_param: string }; Returns: number }
      count_user_games: { Args: { user_id_param: string }; Returns: number }
      is_game_gm_or_co_gm: {
        Args: { game_id_param: string; user_id_param: string }
        Returns: boolean
      }
      is_game_participant: {
        Args: { game_id_param: string; user_id_param: string }
        Returns: boolean
      }
      is_membership_co_gm: {
        Args: { membership_game_id: string; membership_user_id: string }
        Returns: boolean
      }
      join_game_by_invite: {
        Args: { invite_code_param: string }
        Returns: string
      }
      shares_game_with: { Args: { target_user_id: string }; Returns: boolean }
      uuid_generate_v1: { Args: never; Returns: string }
      uuid_generate_v1mc: { Args: never; Returns: string }
      uuid_generate_v3: {
        Args: { name: string; namespace: string }
        Returns: string
      }
      uuid_generate_v4: { Args: never; Returns: string }
      uuid_generate_v5: {
        Args: { name: string; namespace: string }
        Returns: string
      }
      uuid_nil: { Args: never; Returns: string }
      uuid_ns_dns: { Args: never; Returns: string }
      uuid_ns_oid: { Args: never; Returns: string }
      uuid_ns_url: { Args: never; Returns: string }
      uuid_ns_x500: { Args: never; Returns: string }
    }
    Enums: {
      availability_status: "available" | "unavailable" | "maybe"
      session_status: "confirmed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      availability_status: ["available", "unavailable", "maybe"],
      session_status: ["confirmed"],
    },
  },
} as const
