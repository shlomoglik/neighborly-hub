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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      apartments: {
        Row: {
          building_id: string
          floor: number
          id: string
          number: number
        }
        Insert: {
          building_id: string
          floor: number
          id?: string
          number: number
        }
        Update: {
          building_id?: string
          floor?: number
          id?: string
          number?: number
        }
        Relationships: [
          {
            foreignKeyName: "apartments_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          created_at: string
          floors: number
          id: string
          name: string
          project_id: string
          units_per_floor: number
        }
        Insert: {
          created_at?: string
          floors: number
          id?: string
          name: string
          project_id: string
          units_per_floor: number
        }
        Update: {
          created_at?: string
          floors?: number
          id?: string
          name?: string
          project_id?: string
          units_per_floor?: number
        }
        Relationships: [
          {
            foreignKeyName: "buildings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_emails: {
        Row: {
          contact_id: string
          email: string
          id: string
          visibility: Database["public"]["Enums"]["visibility_level"]
        }
        Insert: {
          contact_id: string
          email: string
          id?: string
          visibility?: Database["public"]["Enums"]["visibility_level"]
        }
        Update: {
          contact_id?: string
          email?: string
          id?: string
          visibility?: Database["public"]["Enums"]["visibility_level"]
        }
        Relationships: [
          {
            foreignKeyName: "contact_emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_phones: {
        Row: {
          contact_id: string
          id: string
          label: string | null
          number: string
          visibility: Database["public"]["Enums"]["visibility_level"]
        }
        Insert: {
          contact_id: string
          id?: string
          label?: string | null
          number: string
          visibility?: Database["public"]["Enums"]["visibility_level"]
        }
        Update: {
          contact_id?: string
          id?: string
          label?: string | null
          number?: string
          visibility?: Database["public"]["Enums"]["visibility_level"]
        }
        Relationships: [
          {
            foreignKeyName: "contact_phones_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          birth_date: string | null
          full_name: string
          household_id: string
          id: string
          is_child: boolean
          is_primary: boolean
          relation: string | null
          sort: number
        }
        Insert: {
          birth_date?: string | null
          full_name: string
          household_id: string
          id?: string
          is_child?: boolean
          is_primary?: boolean
          relation?: string | null
          sort?: number
        }
        Update: {
          birth_date?: string | null
          full_name?: string
          household_id?: string
          id?: string
          is_child?: boolean
          is_primary?: boolean
          relation?: string | null
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "contacts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          apartment_id: string
          avatar_url: string | null
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          ownership: Database["public"]["Enums"]["ownership_type"]
          status: Database["public"]["Enums"]["household_status"]
        }
        Insert: {
          apartment_id: string
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          display_name: string
          id?: string
          ownership: Database["public"]["Enums"]["ownership_type"]
          status?: Database["public"]["Enums"]["household_status"]
        }
        Update: {
          apartment_id?: string
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          ownership?: Database["public"]["Enums"]["ownership_type"]
          status?: Database["public"]["Enums"]["household_status"]
        }
        Relationships: [
          {
            foreignKeyName: "households_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          city: string | null
          created_at: string
          id: string
          name: string
          visibility: Database["public"]["Enums"]["project_visibility"]
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          name: string
          visibility?: Database["public"]["Enums"]["project_visibility"]
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          visibility?: Database["public"]["Enums"]["project_visibility"]
        }
        Relationships: []
      }
      staff: {
        Row: {
          building_id: string | null
          created_at: string
          id: string
          project_id: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Insert: {
          building_id?: string | null
          created_at?: string
          id?: string
          project_id: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Update: {
          building_id?: string | null
          created_at?: string
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      assign_staff: {
        Args: {
          _building: string
          _email: string
          _project: string
          _role: Database["public"]["Enums"]["staff_role"]
        }
        Returns: undefined
      }
      can_edit_contact: {
        Args: { _contact: string; _uid: string }
        Returns: boolean
      }
      can_manage_household: {
        Args: { _hh: string; _uid: string }
        Returns: boolean
      }
      can_view_contact_item: {
        Args: {
          _contact: string
          _uid: string
          _vis: Database["public"]["Enums"]["visibility_level"]
        }
        Returns: boolean
      }
      can_view_household: {
        Args: { _hh: string; _uid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      household_building: { Args: { _hh: string }; Returns: string }
      is_building_manager: {
        Args: { _building: string; _uid: string }
        Returns: boolean
      }
      is_member_of_project: {
        Args: { _project: string; _uid: string }
        Returns: boolean
      }
      is_project_manager: {
        Args: { _project: string; _uid: string }
        Returns: boolean
      }
      is_resident_of_building: {
        Args: { _building: string; _uid: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      household_status: "pending" | "approved" | "rejected"
      ownership_type: "owner_resident" | "tenant" | "owner_non_resident"
      project_visibility: "community" | "building"
      staff_role: "project_manager" | "building_manager"
      visibility_level: "project" | "building" | "managers"
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
      app_role: ["admin", "user"],
      household_status: ["pending", "approved", "rejected"],
      ownership_type: ["owner_resident", "tenant", "owner_non_resident"],
      project_visibility: ["community", "building"],
      staff_role: ["project_manager", "building_manager"],
      visibility_level: ["project", "building", "managers"],
    },
  },
} as const
