export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          is_active: boolean
          leverage: number
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          leverage?: number
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          leverage?: number
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          meta: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          meta?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          meta?: Json
        }
        Relationships: []
      }
      binary_trades: {
        Row: {
          account_id: string
          created_at: string
          direction: Database["public"]["Enums"]["binary_direction"]
          duration_seconds: number
          entry_price: number
          expires_at: string
          expiry_price: number | null
          id: string
          opened_at: string
          payout: number | null
          payout_rate: number
          settled_at: string | null
          stake: number
          status: Database["public"]["Enums"]["binary_status"]
          symbol: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["binary_direction"]
          duration_seconds: number
          entry_price: number
          expires_at: string
          expiry_price?: number | null
          id?: string
          opened_at?: string
          payout?: number | null
          payout_rate?: number
          settled_at?: string | null
          stake: number
          status?: Database["public"]["Enums"]["binary_status"]
          symbol: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["binary_direction"]
          duration_seconds?: number
          entry_price?: number
          expires_at?: string
          expiry_price?: number | null
          id?: string
          opened_at?: string
          payout?: number | null
          payout_rate?: number
          settled_at?: string | null
          stake?: number
          status?: Database["public"]["Enums"]["binary_status"]
          symbol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "binary_trades_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      instruments: {
        Row: {
          base_price: number
          category: Database["public"]["Enums"]["instrument_category"]
          contract_size: number
          created_at: string
          digits: number
          id: string
          is_tradable: boolean
          name: string
          spread: number
          symbol: string
          volatility: number
        }
        Insert: {
          base_price: number
          category: Database["public"]["Enums"]["instrument_category"]
          contract_size?: number
          created_at?: string
          digits?: number
          id?: string
          is_tradable?: boolean
          name: string
          spread?: number
          symbol: string
          volatility?: number
        }
        Update: {
          base_price?: number
          category?: Database["public"]["Enums"]["instrument_category"]
          contract_size?: number
          created_at?: string
          digits?: number
          id?: string
          is_tradable?: boolean
          name?: string
          spread?: number
          symbol?: string
          volatility?: number
        }
        Relationships: []
      }
      kyc_submissions: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          document_number: string | null
          document_ref: string | null
          document_type: string | null
          first_name: string | null
          id: string
          last_name: string | null
          nationality: string | null
          postal_code: string | null
          proof_of_address_ref: string | null
          review_note: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          document_number?: string | null
          document_ref?: string | null
          document_type?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          nationality?: string | null
          postal_code?: string | null
          proof_of_address_ref?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          document_number?: string | null
          document_ref?: string | null
          document_type?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          nationality?: string | null
          postal_code?: string | null
          proof_of_address_ref?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          account_id: string
          created_at: string
          filled_at: string | null
          filled_price: number | null
          id: string
          kind: Database["public"]["Enums"]["order_kind"]
          limit_price: number | null
          quantity: number
          reject_reason: string | null
          side: Database["public"]["Enums"]["order_side"]
          status: Database["public"]["Enums"]["order_status"]
          stop_loss: number | null
          stop_price: number | null
          symbol: string
          take_profit: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          filled_at?: string | null
          filled_price?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["order_kind"]
          limit_price?: number | null
          quantity: number
          reject_reason?: string | null
          side: Database["public"]["Enums"]["order_side"]
          status?: Database["public"]["Enums"]["order_status"]
          stop_loss?: number | null
          stop_price?: number | null
          symbol: string
          take_profit?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          filled_at?: string | null
          filled_price?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["order_kind"]
          limit_price?: number | null
          quantity?: number
          reject_reason?: string | null
          side?: Database["public"]["Enums"]["order_side"]
          status?: Database["public"]["Enums"]["order_status"]
          stop_loss?: number | null
          stop_price?: number | null
          symbol?: string
          take_profit?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          kind: string
          label: string
          last4: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          kind?: string
          label: string
          last4?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          kind?: string
          label?: string
          last4?: string | null
          user_id?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          account_id: string
          close_price: number | null
          closed_at: string | null
          entry_price: number
          id: string
          margin: number
          opened_at: string
          order_id: string | null
          quantity: number
          realized_pl: number | null
          side: Database["public"]["Enums"]["order_side"]
          status: Database["public"]["Enums"]["position_status"]
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          close_price?: number | null
          closed_at?: string | null
          entry_price: number
          id?: string
          margin?: number
          opened_at?: string
          order_id?: string | null
          quantity: number
          realized_pl?: number | null
          side: Database["public"]["Enums"]["order_side"]
          status?: Database["public"]["Enums"]["position_status"]
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          close_price?: number | null
          closed_at?: string | null
          entry_price?: number
          id?: string
          margin?: number
          opened_at?: string
          order_id?: string | null
          quantity?: number
          realized_pl?: number | null
          side?: Database["public"]["Enums"]["order_side"]
          status?: Database["public"]["Enums"]["position_status"]
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          country: string | null
          created_at: string
          default_leverage: number
          default_lots: number
          email: string
          full_name: string
          id: string
          is_suspended: boolean
          language: string
          notify_email: boolean
          notify_push: boolean
          notify_trade_alerts: boolean
          phone: string | null
          theme: string
          two_factor_enabled: boolean
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          default_leverage?: number
          default_lots?: number
          email?: string
          full_name?: string
          id: string
          is_suspended?: boolean
          language?: string
          notify_email?: boolean
          notify_push?: boolean
          notify_trade_alerts?: boolean
          phone?: string | null
          theme?: string
          two_factor_enabled?: boolean
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          default_leverage?: number
          default_lots?: number
          email?: string
          full_name?: string
          id?: string
          is_suspended?: boolean
          language?: string
          notify_email?: boolean
          notify_push?: boolean
          notify_trade_alerts?: boolean
          phone?: string | null
          theme?: string
          two_factor_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          id: string
          method: string | null
          note: string | null
          reference: string | null
          status: Database["public"]["Enums"]["txn_status"]
          type: Database["public"]["Enums"]["txn_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          id?: string
          method?: string | null
          note?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["txn_status"]
          type: Database["public"]["Enums"]["txn_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          id?: string
          method?: string | null
          note?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["txn_status"]
          type?: Database["public"]["Enums"]["txn_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      watchlist_items: {
        Row: {
          created_at: string
          id: string
          symbol: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          symbol: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      account_type: "demo" | "live"
      app_role: "admin" | "user"
      binary_direction: "up" | "down"
      binary_status: "open" | "won" | "lost" | "tie"
      instrument_category:
        | "forex"
        | "stocks"
        | "crypto"
        | "indices"
        | "commodities"
      kyc_status: "not_started" | "pending" | "approved" | "rejected"
      order_kind: "market" | "limit" | "stop"
      order_side: "buy" | "sell"
      order_status: "pending" | "filled" | "cancelled" | "rejected"
      position_status: "open" | "closed"
      txn_status: "pending" | "completed" | "rejected"
      txn_type: "deposit" | "withdrawal" | "trade" | "fee" | "adjustment"
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
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
      account_type: ["demo", "live"],
      app_role: ["admin", "user"],
      binary_direction: ["up", "down"],
      binary_status: ["open", "won", "lost", "tie"],
      instrument_category: [
        "forex",
        "stocks",
        "crypto",
        "indices",
        "commodities",
      ],
      kyc_status: ["not_started", "pending", "approved", "rejected"],
      order_kind: ["market", "limit", "stop"],
      order_side: ["buy", "sell"],
      order_status: ["pending", "filled", "cancelled", "rejected"],
      position_status: ["open", "closed"],
      txn_status: ["pending", "completed", "rejected"],
      txn_type: ["deposit", "withdrawal", "trade", "fee", "adjustment"],
    },
  },
} as const
