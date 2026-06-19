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
      audit_logs: {
        Row: {
          action: string
          entity_id: string | null
          entity_type: string
          id: string
          log_type: string
          metadata: Json
          status: string | null
          timestamp: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          entity_id?: string | null
          entity_type: string
          id?: string
          log_type?: string
          metadata?: Json
          status?: string | null
          timestamp?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          log_type?: string
          metadata?: Json
          status?: string | null
          timestamp?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
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
      dam_transactions: {
        Row: {
          change_liters: number
          change_tons: number
          created_at: string
          dam_id: string
          id: string
          load_id: string
          resulting_balance_liters: number
          resulting_balance_tons: number
        }
        Insert: {
          change_liters: number
          change_tons: number
          created_at?: string
          dam_id: string
          id?: string
          load_id: string
          resulting_balance_liters: number
          resulting_balance_tons: number
        }
        Update: {
          change_liters?: number
          change_tons?: number
          created_at?: string
          dam_id?: string
          id?: string
          load_id?: string
          resulting_balance_liters?: number
          resulting_balance_tons?: number
        }
        Relationships: [
          {
            foreignKeyName: "dam_transactions_dam_id_fkey"
            columns: ["dam_id"]
            isOneToOne: false
            referencedRelation: "dams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dam_transactions_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: true
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
        ]
      }
      dams: {
        Row: {
          capacity_liters: number | null
          capacity_tons: number | null
          created_at: string
          current_volume_liters: number
          current_volume_tons: number
          deleted_at: string | null
          id: string
          is_demo: boolean
          location: string | null
          name: string
          notes: string | null
          starting_balance_tons: number
          status: Database["public"]["Enums"]["dam_status"]
          updated_at: string
        }
        Insert: {
          capacity_liters?: number | null
          capacity_tons?: number | null
          created_at?: string
          current_volume_liters?: number
          current_volume_tons?: number
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          location?: string | null
          name: string
          notes?: string | null
          starting_balance_tons?: number
          status?: Database["public"]["Enums"]["dam_status"]
          updated_at?: string
        }
        Update: {
          capacity_liters?: number | null
          capacity_tons?: number | null
          created_at?: string
          current_volume_liters?: number
          current_volume_tons?: number
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          location?: string | null
          name?: string
          notes?: string | null
          starting_balance_tons?: number
          status?: Database["public"]["Enums"]["dam_status"]
          updated_at?: string
        }
        Relationships: []
      }
      loads: {
        Row: {
          created_at: string
          created_by: string
          dam_id: string
          deleted_at: string | null
          fgc_net_mass: number
          id: string
          is_demo: boolean
          status: Database["public"]["Enums"]["load_status"]
          timestamp: string
          truck_id: string
          type: Database["public"]["Enums"]["load_type"]
          updated_at: string
          volume_liters: number
          weight_tons: number
        }
        Insert: {
          created_at?: string
          created_by: string
          dam_id: string
          deleted_at?: string | null
          fgc_net_mass: number
          id?: string
          is_demo?: boolean
          status?: Database["public"]["Enums"]["load_status"]
          timestamp?: string
          truck_id: string
          type: Database["public"]["Enums"]["load_type"]
          updated_at?: string
          volume_liters: number
          weight_tons: number
        }
        Update: {
          created_at?: string
          created_by?: string
          dam_id?: string
          deleted_at?: string | null
          fgc_net_mass?: number
          id?: string
          is_demo?: boolean
          status?: Database["public"]["Enums"]["load_status"]
          timestamp?: string
          truck_id?: string
          type?: Database["public"]["Enums"]["load_type"]
          updated_at?: string
          volume_liters?: number
          weight_tons?: number
        }
        Relationships: [
          {
            foreignKeyName: "loads_dam_id_fkey"
            columns: ["dam_id"]
            isOneToOne: false
            referencedRelation: "dams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loads_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
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
          is_demo: boolean
          movement_type: string
          notes: string | null
          occurred_at: string
          quantity_tons: number
          scanned_document_url: string | null
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
          version: number
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
          is_demo?: boolean
          movement_type: string
          notes?: string | null
          occurred_at?: string
          quantity_tons: number
          scanned_document_url?: string | null
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
          version?: number
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
          is_demo?: boolean
          movement_type?: string
          notes?: string | null
          occurred_at?: string
          quantity_tons?: number
          scanned_document_url?: string | null
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
          version?: number
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
          deactivated_at: string | null
          deactivated_by: string | null
          email: string
          full_name: string | null
          id: string
          last_active_at: string | null
          status: string
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          email: string
          full_name?: string | null
          id: string
          last_active_at?: string | null
          status?: string
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          email?: string
          full_name?: string | null
          id?: string
          last_active_at?: string | null
          status?: string
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      report_audit_log: {
        Row: {
          action: Database["public"]["Enums"]["report_audit_action"]
          created_at: string
          id: string
          metadata: Json
          report_id: string
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["report_audit_action"]
          created_at?: string
          id?: string
          metadata?: Json
          report_id: string
          user_id?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["report_audit_action"]
          created_at?: string
          id?: string
          metadata?: Json
          report_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_audit_log_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_versions: {
        Row: {
          created_at: string
          created_by: string
          file_path: string
          file_size: number
          file_type: Database["public"]["Enums"]["report_file_type"]
          id: string
          report_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string
          file_path: string
          file_size: number
          file_type: Database["public"]["Enums"]["report_file_type"]
          id?: string
          report_id: string
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string
          file_path?: string
          file_size?: number
          file_type?: Database["public"]["Enums"]["report_file_type"]
          id?: string
          report_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_versions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          current_version_id: string | null
          deleted_at: string | null
          description: string | null
          file_url: string | null
          filters: Json
          generated_by: string | null
          id: string
          is_deleted: boolean
          status: Database["public"]["Enums"]["report_status"]
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_version_id?: string | null
          deleted_at?: string | null
          description?: string | null
          file_url?: string | null
          filters?: Json
          generated_by?: string | null
          id?: string
          is_deleted?: boolean
          status?: Database["public"]["Enums"]["report_status"]
          title: string
          type: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          current_version_id?: string | null
          deleted_at?: string | null
          description?: string | null
          file_url?: string | null
          filters?: Json
          generated_by?: string | null
          id?: string
          is_deleted?: boolean
          status?: Database["public"]["Enums"]["report_status"]
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_current_version_id_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "report_versions"
            referencedColumns: ["id"]
          },
        ]
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
      trucks: {
        Row: {
          created_at: string
          deleted_at: string | null
          driver_name: string
          id: string
          is_demo: boolean
          registration_number: string
          status: Database["public"]["Enums"]["truck_status"]
          transporter_company: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          driver_name: string
          id?: string
          is_demo?: boolean
          registration_number: string
          status?: Database["public"]["Enums"]["truck_status"]
          transporter_company: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          driver_name?: string
          id?: string
          is_demo?: boolean
          registration_number?: string
          status?: Database["public"]["Enums"]["truck_status"]
          transporter_company?: string
          updated_at?: string
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
      bulk_insert_movements: {
        Args: { force?: boolean; payloads: Json }
        Returns: Json
      }
      can_operate: { Args: never; Returns: boolean }
      can_view_operations: { Args: never; Returns: boolean }
      create_load_transaction: {
        Args: {
          _dam_id: string
          _fgc_net_mass: number
          _status?: Database["public"]["Enums"]["load_status"]
          _timestamp?: string
          _truck_id: string
          _type: Database["public"]["Enums"]["load_type"]
          _volume_liters?: number
        }
        Returns: {
          created_at: string
          created_by: string
          dam_id: string
          deleted_at: string | null
          fgc_net_mass: number
          id: string
          is_demo: boolean
          status: Database["public"]["Enums"]["load_status"]
          timestamp: string
          truck_id: string
          type: Database["public"]["Enums"]["load_type"]
          updated_at: string
          volume_liters: number
          weight_tons: number
        }
        SetofOptions: {
          from: "*"
          to: "loads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_movement_force: {
        Args: { payload: Json }
        Returns: {
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
          is_demo: boolean
          movement_type: string
          notes: string | null
          occurred_at: string
          quantity_tons: number
          scanned_document_url: string | null
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
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_active: { Args: { _user_id: string }; Returns: boolean }
      is_demo_user: { Args: never; Returns: boolean }
      log_audit_event: {
        Args: {
          _action: string
          _entity_id?: string
          _entity_type?: string
          _log_type: string
          _metadata?: Json
          _status?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "operator" | "viewer" | "supervisor" | "demo"
      dam_status: "active" | "maintenance"
      load_status: "pending" | "completed" | "cancelled"
      load_type: "incoming" | "outgoing"
      report_audit_action:
        | "created"
        | "updated"
        | "deleted"
        | "restored"
        | "downloaded"
      report_file_type: "pdf" | "xlsx" | "docx"
      report_status: "draft" | "active" | "archived"
      truck_status: "idle" | "en_route" | "waiting" | "offloading"
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
      app_role: ["admin", "operator", "viewer", "supervisor", "demo"],
      dam_status: ["active", "maintenance"],
      load_status: ["pending", "completed", "cancelled"],
      load_type: ["incoming", "outgoing"],
      report_audit_action: [
        "created",
        "updated",
        "deleted",
        "restored",
        "downloaded",
      ],
      report_file_type: ["pdf", "xlsx", "docx"],
      report_status: ["draft", "active", "archived"],
      truck_status: ["idle", "en_route", "waiting", "offloading"],
    },
  },
} as const
