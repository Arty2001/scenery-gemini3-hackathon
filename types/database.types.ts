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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      compositions: {
        Row: {
          created_at: string | null
          duration_in_frames: number
          fps: number
          height: number
          id: string
          name: string
          project_id: string
          scenes: Json
          tracks: Json
          updated_at: string | null
          width: number
        }
        Insert: {
          created_at?: string | null
          duration_in_frames?: number
          fps?: number
          height?: number
          id?: string
          name?: string
          project_id: string
          scenes?: Json
          tracks?: Json
          updated_at?: string | null
          width?: number
        }
        Update: {
          created_at?: string | null
          duration_in_frames?: number
          fps?: number
          height?: number
          id?: string
          name?: string
          project_id?: string
          scenes?: Json
          tracks?: Json
          updated_at?: string | null
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "compositions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_components: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          original_html: string
          preview_html: string
          project_id: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          original_html: string
          preview_html: string
          project_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          original_html?: string
          preview_html?: string
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_components_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      discovered_components: {
        Row: {
          analysis_error: string | null
          category: string | null
          category_confidence: number | null
          component_name: string
          created_at: string | null
          demo_props: Json | null
          demo_props_confidence: string | null
          description: string | null
          display_name: string | null
          file_path: string
          id: string
          interactive_elements: Json | null
          is_compound_child: boolean | null
          parent_component_id: string | null
          preview_html: string | null
          props_schema: Json
          related_components: string[] | null
          repository_id: string
          secondary_categories: string[] | null
          updated_at: string | null
          used_by_components: string[] | null
          uses_components: string[] | null
        }
        Insert: {
          analysis_error?: string | null
          category?: string | null
          category_confidence?: number | null
          component_name: string
          created_at?: string | null
          demo_props?: Json | null
          demo_props_confidence?: string | null
          description?: string | null
          display_name?: string | null
          file_path: string
          id?: string
          interactive_elements?: Json | null
          is_compound_child?: boolean | null
          parent_component_id?: string | null
          preview_html?: string | null
          props_schema?: Json
          related_components?: string[] | null
          repository_id: string
          secondary_categories?: string[] | null
          updated_at?: string | null
          used_by_components?: string[] | null
          uses_components?: string[] | null
        }
        Update: {
          analysis_error?: string | null
          category?: string | null
          category_confidence?: number | null
          component_name?: string
          created_at?: string | null
          demo_props?: Json | null
          demo_props_confidence?: string | null
          description?: string | null
          display_name?: string | null
          file_path?: string
          id?: string
          interactive_elements?: Json | null
          is_compound_child?: boolean | null
          parent_component_id?: string | null
          preview_html?: string | null
          props_schema?: Json
          related_components?: string[] | null
          repository_id?: string
          secondary_categories?: string[] | null
          updated_at?: string | null
          used_by_components?: string[] | null
          uses_components?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "discovered_components_parent_component_id_fkey"
            columns: ["parent_component_id"]
            isOneToOne: false
            referencedRelation: "discovered_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovered_components_repository_id_fkey"
            columns: ["repository_id"]
            isOneToOne: false
            referencedRelation: "repository_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      github_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          refresh_token: string | null
          scopes: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "github_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_demo: boolean | null
          name: string
          repo_url: string | null
          thumbnail_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean | null
          name: string
          repo_url?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean | null
          name?: string
          repo_url?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      render_jobs: {
        Row: {
          bucket_name: string | null
          composition_id: string
          created_at: string
          error: string | null
          id: string
          output_url: string | null
          progress: number
          quality: string
          render_id: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bucket_name?: string | null
          composition_id: string
          created_at?: string
          error?: string | null
          id?: string
          output_url?: string | null
          progress?: number
          quality?: string
          render_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bucket_name?: string | null
          composition_id?: string
          created_at?: string
          error?: string | null
          id?: string
          output_url?: string | null
          progress?: number
          quality?: string
          render_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "render_jobs_composition_id_fkey"
            columns: ["composition_id"]
            isOneToOne: false
            referencedRelation: "compositions"
            referencedColumns: ["id"]
          },
        ]
      }
      repository_connections: {
        Row: {
          clone_url: string
          created_at: string | null
          default_branch: string
          full_name: string | null
          id: string
          is_private: boolean
          last_synced_at: string | null
          local_path: string | null
          name: string
          owner: string
          project_id: string
          updated_at: string | null
        }
        Insert: {
          clone_url: string
          created_at?: string | null
          default_branch?: string
          full_name?: string | null
          id?: string
          is_private?: boolean
          last_synced_at?: string | null
          local_path?: string | null
          name: string
          owner: string
          project_id: string
          updated_at?: string | null
        }
        Update: {
          clone_url?: string
          created_at?: string | null
          default_branch?: string
          full_name?: string | null
          id?: string
          is_private?: boolean
          last_synced_at?: string | null
          local_path?: string | null
          name?: string
          owner?: string
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repository_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
