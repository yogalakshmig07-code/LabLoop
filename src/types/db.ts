export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "user" | "owner" | "manager" | "admin";
export type ResourceCategory = "lab" | "room" | "equipment" | "computing" | "media";
export type PriorityTier = "coursework" | "research" | "personal";
export type BookingStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "waitlisted"
  | "cancelled"
  | "checked_out"
  | "returned";
export type CredentialStatus = "pending" | "verified" | "rejected" | "expired";
export type IncidentType = "damage" | "delay" | "conflict" | "safety" | "other";
export type IncidentStatus = "open" | "under_review" | "resolved" | "disputed";
export type ConditionGrade = "excellent" | "good" | "fair" | "damaged";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          role: UserRole;
          department: string | null;
          owner_verified: boolean;
          strikes: number;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          role?: UserRole;
          department?: string | null;
          owner_verified?: boolean;
          strikes?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          role?: UserRole;
          department?: string | null;
          owner_verified?: boolean;
          strikes?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      credentials: {
        Row: {
          id: string;
          user_id: string;
          credential_type: string;
          file_path: string | null;
          status: CredentialStatus;
          verified_by: string | null;
          verified_at: string | null;
          expires_at: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          credential_type: string;
          file_path?: string | null;
          status?: CredentialStatus;
          verified_by?: string | null;
          verified_at?: string | null;
          expires_at?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          credential_type?: string;
          file_path?: string | null;
          status?: CredentialStatus;
          verified_by?: string | null;
          verified_at?: string | null;
          expires_at?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      resources: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          category: ResourceCategory;
          location: string | null;
          image_path: string | null;
          is_active: boolean;
          requires_supervision: boolean;
          max_duration_hours: number;
          buffer_minutes: number;
          usage_rules: string | null;
          deposit_note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          description?: string | null;
          category: ResourceCategory;
          location?: string | null;
          image_path?: string | null;
          is_active?: boolean;
          requires_supervision?: boolean;
          max_duration_hours?: number;
          buffer_minutes?: number;
          usage_rules?: string | null;
          deposit_note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          description?: string | null;
          category?: ResourceCategory;
          location?: string | null;
          image_path?: string | null;
          is_active?: boolean;
          requires_supervision?: boolean;
          max_duration_hours?: number;
          buffer_minutes?: number;
          usage_rules?: string | null;
          deposit_note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      resource_managers: {
        Row: {
          resource_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          resource_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          resource_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      resource_requirements: {
        Row: {
          id: string;
          resource_id: string;
          credential_type: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          resource_id: string;
          credential_type: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          resource_id?: string;
          credential_type?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      availability_windows: {
        Row: {
          id: string;
          resource_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          resource_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          resource_id?: string;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          resource_id: string;
          user_id: string;
          start_at: string;
          end_at: string;
          purpose: string | null;
          priority_tier: PriorityTier;
          status: BookingStatus;
          decision_reason: string | null;
          decided_by: string | null;
          decided_at: string | null;
          system_check: Json;
          rules_acknowledged: boolean;
          waitlist_rank: number | null;
          checked_out_at: string | null;
          returned_at: string | null;
          ext_requested_end_at: string | null;
          ext_status: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          resource_id: string;
          user_id: string;
          start_at: string;
          end_at: string;
          purpose?: string | null;
          priority_tier?: PriorityTier;
          status?: BookingStatus;
          decision_reason?: string | null;
          decided_by?: string | null;
          decided_at?: string | null;
          system_check?: Json;
          rules_acknowledged?: boolean;
          waitlist_rank?: number | null;
          checked_out_at?: string | null;
          returned_at?: string | null;
          ext_requested_end_at?: string | null;
          ext_status?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          resource_id?: string;
          user_id?: string;
          start_at?: string;
          end_at?: string;
          purpose?: string | null;
          priority_tier?: PriorityTier;
          status?: BookingStatus;
          decision_reason?: string | null;
          decided_by?: string | null;
          decided_at?: string | null;
          system_check?: Json;
          rules_acknowledged?: boolean;
          waitlist_rank?: number | null;
          checked_out_at?: string | null;
          returned_at?: string | null;
          ext_requested_end_at?: string | null;
          ext_status?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      condition_reports: {
        Row: {
          id: string;
          booking_id: string;
          kind: "checkout" | "return";
          grade: ConditionGrade;
          notes: string | null;
          checklist: Json;
          photo_paths: string[];
          recorded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          kind: "checkout" | "return";
          grade: ConditionGrade;
          notes?: string | null;
          checklist?: Json;
          photo_paths?: string[];
          recorded_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          kind?: "checkout" | "return";
          grade?: ConditionGrade;
          notes?: string | null;
          checklist?: Json;
          photo_paths?: string[];
          recorded_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      incidents: {
        Row: {
          id: string;
          booking_id: string | null;
          resource_id: string;
          reported_by: string;
          incident_type: IncidentType;
          severity: "low" | "medium" | "high";
          description: string;
          ai_summary: string | null;
          status: IncidentStatus;
          resolution: string | null;
          resolved_by: string | null;
          strike_applied: boolean;
          dispute_note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id?: string | null;
          resource_id: string;
          reported_by: string;
          incident_type: IncidentType;
          severity: "low" | "medium" | "high";
          description: string;
          ai_summary?: string | null;
          status?: IncidentStatus;
          resolution?: string | null;
          resolved_by?: string | null;
          strike_applied?: boolean;
          dispute_note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string | null;
          resource_id?: string;
          reported_by?: string;
          incident_type?: IncidentType;
          severity?: "low" | "medium" | "high";
          description?: string;
          ai_summary?: string | null;
          status?: IncidentStatus;
          resolution?: string | null;
          resolved_by?: string | null;
          strike_applied?: boolean;
          dispute_note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string;
          link: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          body: string;
          link?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          body?: string;
          link?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: number;
          actor_id: string | null;
          actor_name: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          booking_id: string | null;
          resource_id: string | null;
          reason: string | null;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: never;
          actor_id?: string | null;
          actor_name?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          booking_id?: string | null;
          resource_id?: string | null;
          reason?: string | null;
          details?: Json;
          created_at?: string;
        };
        Update: {
          id?: never;
          actor_id?: string | null;
          actor_name?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          booking_id?: string | null;
          resource_id?: string | null;
          reason?: string | null;
          details?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      fairness_settings: {
        Row: {
          id: number;
          max_active_bookings: number;
          max_hours_per_week_per_category: number;
          strike_threshold: number;
          reminder_minutes_before: number;
        };
        Insert: {
          id?: number;
          max_active_bookings?: number;
          max_hours_per_week_per_category?: number;
          strike_threshold?: number;
          reminder_minutes_before?: number;
        };
        Update: {
          id?: number;
          max_active_bookings?: number;
          max_hours_per_week_per_category?: number;
          strike_threshold?: number;
          reminder_minutes_before?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_resource_owner_or_manager: {
        Args: {
          res_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      resource_category: ResourceCategory;
      priority_tier: PriorityTier;
      booking_status: BookingStatus;
      credential_status: CredentialStatus;
      incident_type: IncidentType;
      incident_status: IncidentStatus;
      condition_grade: ConditionGrade;
    };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Profile = Tables<"profiles">;
export type Credential = Tables<"credentials">;
export type Resource = Tables<"resources">;
export type ResourceManager = Tables<"resource_managers">;
export type ResourceRequirement = Tables<"resource_requirements">;
export type AvailabilityWindow = Tables<"availability_windows">;
export type Booking = Tables<"bookings">;
export type ConditionReport = Tables<"condition_reports">;
export type Incident = Tables<"incidents">;
export type Notification = Tables<"notifications">;
export type AuditLog = Tables<"audit_log">;
export type FairnessSettings = Tables<"fairness_settings">;

