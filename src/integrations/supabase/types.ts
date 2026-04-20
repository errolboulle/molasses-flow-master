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
      dam_adjustments: {
        Row: {
          created_at: string
          dam_id: string
          difference_tons: number | null
          id: string
          new_volume_tons: number
          previous_volume_tons: number
          reason: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dam_id: string
          difference_tons?: number | null
          id?: string
          new_volume_tons: number
          previous_volume_tons: number
          reason: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dam_id?: string
          difference_tons?: number | null
          id?: string
          new_volume_tons?: number
          previous_volume_tons?: number
          reason?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dam_adjustments_dam_id_fkey"
            columns: ["dam_id"]
            isOneToOne: false
            referencedRelation: "dams"
            referencedColumns: ["id"]
          },
        ]
      }
      dams: {
        Row: {
          capacity_tons: number | null
          created_at: string
          current_volume_tons: number
          id: string
          name: string
          notes: string | null
          starting_balance_tons: number
          updated_at: string
        }
        Insert: {
          capacity_tons?: number | null
          created_at?: string
          current_volume_tons?: number
          id?: string
          name: string
          notes?: string | null
          starting_balance_tons?: number
          updated_at?: string
        }
        Update: {
          capacity_tons?: number | null
          created_at?: string
          current_volume_tons?: number
          id?: string
          name?: string
          notes?: string | null
          starting_balance_tons?: number
          updated_at?: string
        }
        Relationships: []
      }
      movements: {
        Row: {
          created_at: string
          created_by: string | null
          dam_id: string
          driver_or_company: string | null
          fgc_brix: number | null
          fgc_consignment_note_number: string | null
          fgc_date_of_arrival: string | null
          fgc_gross_mass: number | null
          fgc_haulier: string | null
          fgc_if_out_haulier: string | null
          fgc_in: number | null
          fgc_in_out: string | null
          fgc_net: number | null
          fgc_net_mass: number | null
          fgc_out: number | null
          fgc_tare_mass: number | null
          fgc_time: string | null
          fgc_variance: number | null
          fgc_vehicle_registration: string | null
          fgc_zsm_operator: string | null
          fgc_zsm_weighbridge_number: string | null
          id: string
          movement_type: string
          notes: string | null
          occurred_at: string
          quantity_tons: number
          src_date_of_departure: string | null
          src_delivery_note: string | null
          src_gross_mass: number | null
          src_haulier: string | null
          src_mill: string | null
          src_mill_number: string | null
          src_molasses_temperature: number | null
          src_net_mass: number | null
          src_sample_number: string | null
          src_tare_mass: number | null
          src_time: string | null
          src_vehicle_registration: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dam_id: string
          driver_or_company?: string | null
          fgc_brix?: number | null
          fgc_consignment_note_number?: string | null
          fgc_date_of_arrival?: string | null
          fgc_gross_mass?: number | null
          fgc_haulier?: string | null
          fgc_if_out_haulier?: string | null
          fgc_in?: number | null
          fgc_in_out?: string | null
          fgc_net?: number | null
          fgc_net_mass?: number | null
          fgc_out?: number | null
          fgc_tare_mass?: number | null
          fgc_time?: string | null
          fgc_variance?: number | null
          fgc_vehicle_registration?: string | null
          fgc_zsm_operator?: string | null
          fgc_zsm_weighbridge_number?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          occurred_at?: string
          quantity_tons: number
          src_date_of_departure?: string | null
          src_delivery_note?: string | null
          src_gross_mass?: number | null
          src_haulier?: string | null
          src_mill?: string | null
          src_mill_number?: string | null
          src_molasses_temperature?: number | null
          src_net_mass?: number | null
          src_sample_number?: string | null
          src_tare_mass?: number | null
          src_time?: string | null
          src_vehicle_registration?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dam_id?: string
          driver_or_company?: string | null
          fgc_brix?: number | null
          fgc_consignment_note_number?: string | null
          fgc_date_of_arrival?: string | null
          fgc_gross_mass?: number | null
          fgc_haulier?: string | null
          fgc_if_out_haulier?: string | null
          fgc_in?: number | null
          fgc_in_out?: string | null
          fgc_net?: number | null
          fgc_net_mass?: number | null
          fgc_out?: number | null
          fgc_tare_mass?: number | null
          fgc_time?: string | null
          fgc_variance?: number | null
          fgc_vehicle_registration?: string | null
          fgc_zsm_operator?: string | null
          fgc_zsm_weighbridge_number?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          occurred_at?: string
          quantity_tons?: number
          src_date_of_departure?: string | null
          src_delivery_note?: string | null
          src_gross_mass?: number | null
          src_haulier?: string | null
          src_mill?: string | null
          src_mill_number?: string | null
          src_molasses_temperature?: number | null
          src_net_mass?: number | null
          src_sample_number?: string | null
          src_tare_mass?: number | null
          src_time?: string | null
          src_vehicle_registration?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movements_dam_id_fkey"
            columns: ["dam_id"]
            isOneToOne: false
            referencedRelation: "dams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          last_active_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          last_active_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          last_active_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          density_kg_per_l: number
          id: number
          onboarded: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          density_kg_per_l?: number
          id?: number
          onboarded?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          density_kg_per_l?: number
          id?: number
          onboarded?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
      is_active: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "operator" | "viewer"
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
    Enums: {
      app_role: ["admin", "operator", "viewer"],
    },
  },
} as const
