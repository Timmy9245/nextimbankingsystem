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
          account_number: string
          account_type: string
          balance: number
          created_at: string
          customer_id: string
          id: string
          status: string
        }
        Insert: {
          account_number: string
          account_type: string
          balance?: number
          created_at?: string
          customer_id: string
          id?: string
          status?: string
        }
        Update: {
          account_number?: string
          account_type?: string
          balance?: number
          created_at?: string
          customer_id?: string
          id?: string
          status?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bill_payments: {
        Row: {
          account_id: string
          amount: number
          category: string
          created_at: string
          customer_id: string
          customer_ref: string
          id: string
          provider: string
          reference: string
          status: string
        }
        Insert: {
          account_id: string
          amount: number
          category: string
          created_at?: string
          customer_id: string
          customer_ref: string
          id?: string
          provider: string
          reference: string
          status?: string
        }
        Update: {
          account_id?: string
          amount?: number
          category?: string
          created_at?: string
          customer_id?: string
          customer_ref?: string
          id?: string
          provider?: string
          reference?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_alerts: {
        Row: {
          created_at: string
          customer_id: string
          details: Json | null
          id: string
          reason: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          details?: Json | null
          id?: string
          reason: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          details?: Json | null
          id?: string
          reason?: string
        }
        Relationships: []
      }
      loan_payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          loan_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          loan_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          loan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          account_id: string
          approved_at: string | null
          created_at: string
          customer_id: string
          id: string
          interest_rate: number
          outstanding: number
          principal: number
          purpose: string | null
          status: string
        }
        Insert: {
          account_id: string
          approved_at?: string | null
          created_at?: string
          customer_id: string
          id?: string
          interest_rate?: number
          outstanding: number
          principal: number
          purpose?: string | null
          status?: string
        }
        Update: {
          account_id?: string
          approved_at?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          interest_rate?: number
          outstanding?: number
          principal?: number
          purpose?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          pin_hash: string | null
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          pin_hash?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          pin_hash?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          balance_after: number
          created_at: string
          customer_id: string
          description: string | null
          id: string
          reference: string | null
          status: string
          type: string
        }
        Insert: {
          account_id: string
          amount: number
          balance_after: number
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          reference?: string | null
          status?: string
          type: string
        }
        Update: {
          account_id?: string
          amount?: number
          balance_after?: number
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          reference?: string | null
          status?: string
          type?: string
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
      transfers: {
        Row: {
          amount: number
          created_at: string
          from_account: string
          from_customer: string
          id: string
          reference: string
          status: string
          to_account: string
          to_customer: string
        }
        Insert: {
          amount: number
          created_at?: string
          from_account: string
          from_customer: string
          id?: string
          reference: string
          status?: string
          to_account: string
          to_customer: string
        }
        Update: {
          amount?: number
          created_at?: string
          from_account?: string
          from_customer?: string
          id?: string
          reference?: string
          status?: string
          to_account?: string
          to_customer?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_from_account_fkey"
            columns: ["from_account"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_to_account_fkey"
            columns: ["to_account"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_receipt: { Args: { p_tx: string }; Returns: Json }
      sp_apply_loan: {
        Args: {
          p_account: string
          p_pin: string
          p_principal: number
          p_purpose: string
        }
        Returns: {
          account_id: string
          approved_at: string | null
          created_at: string
          customer_id: string
          id: string
          interest_rate: number
          outstanding: number
          principal: number
          purpose: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "loans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sp_deposit: {
        Args: {
          p_account: string
          p_amount: number
          p_description?: string
          p_pin: string
        }
        Returns: {
          account_id: string
          amount: number
          balance_after: number
          created_at: string
          customer_id: string
          description: string | null
          id: string
          reference: string | null
          status: string
          type: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sp_has_pin: { Args: never; Returns: boolean }
      sp_pay_bill: {
        Args: {
          p_account: string
          p_amount: number
          p_category: string
          p_customer_ref: string
          p_pin: string
          p_provider: string
        }
        Returns: {
          account_id: string
          amount: number
          balance_after: number
          created_at: string
          customer_id: string
          description: string | null
          id: string
          reference: string | null
          status: string
          type: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sp_repay_loan: {
        Args: {
          p_account: string
          p_amount: number
          p_loan: string
          p_pin: string
        }
        Returns: {
          account_id: string
          approved_at: string | null
          created_at: string
          customer_id: string
          id: string
          interest_rate: number
          outstanding: number
          principal: number
          purpose: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "loans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sp_reset_pin: { Args: { p_new: string }; Returns: undefined }
      sp_set_pin: {
        Args: { p_current?: string; p_new: string }
        Returns: undefined
      }
      sp_transfer: {
        Args: {
          p_amount: number
          p_description?: string
          p_from: string
          p_pin: string
          p_to_account_number: string
        }
        Returns: {
          amount: number
          created_at: string
          from_account: string
          from_customer: string
          id: string
          reference: string
          status: string
          to_account: string
          to_customer: string
        }
        SetofOptions: {
          from: "*"
          to: "transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sp_withdraw: {
        Args: {
          p_account: string
          p_amount: number
          p_description?: string
          p_pin: string
        }
        Returns: {
          account_id: string
          amount: number
          balance_after: number
          created_at: string
          customer_id: string
          description: string | null
          id: string
          reference: string | null
          status: string
          type: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_pin: { Args: { p_pin: string; p_uid: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
