import { z } from "zod";

export const BookingCreateSchema = z.object({
  resource_id: z.string().uuid("Invalid resource ID"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date (YYYY-MM-DD)"),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid start time (HH:MM)"),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid end time (HH:MM)"),
  purpose: z.string().min(15, "Purpose must be at least 15 characters describing your session"),
  priority_tier: z.enum(["coursework", "research", "personal"]),
  rules_acknowledged: z.boolean().refine((val) => val === true, {
    message: "You must acknowledge and agree to the resource usage rules",
  }),
  join_waitlist_if_conflict: z.boolean().default(false).optional(),
});

export type BookingCreateInput = z.infer<typeof BookingCreateSchema>;

export const BookingDecisionSchema = z.object({
  booking_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected", "waitlisted"]),
  decision_reason: z.string().min(3, "Please provide a reason"),
});

export type BookingDecisionInput = z.infer<typeof BookingDecisionSchema>;

export const ConditionReportCreateSchema = z.object({
  booking_id: z.string().uuid(),
  kind: z.enum(["checkout", "return"]),
  grade: z.enum(["excellent", "good", "fair", "damaged"]),
  notes: z.string().optional(),
  checklist: z.record(z.any()).default({}),
  photo_paths: z.array(z.string()).default([]),
});

export type ConditionReportCreateInput = z.infer<typeof ConditionReportCreateSchema>;

export const IncidentCreateSchema = z.object({
  booking_id: z.string().uuid().optional().nullable(),
  resource_id: z.string().uuid(),
  incident_type: z.enum(["damage", "delay", "conflict", "safety", "other"]),
  severity: z.enum(["low", "medium", "high"]),
  description: z.string().min(10, "Please provide a detailed description (min 10 characters)"),
});

export type IncidentCreateInput = z.infer<typeof IncidentCreateSchema>;

export const CredentialSubmitSchema = z.object({
  credential_type: z.string().min(2, "Credential type is required"),
  file_path: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export type CredentialSubmitInput = z.infer<typeof CredentialSubmitSchema>;

export const ResourceRequirementSchema = z.object({
  id: z.string().optional(),
  credential_type: z.string().min(2, "Credential title required"),
  description: z.string().optional().nullable(),
});

export const AvailabilityWindowSchema = z.object({
  id: z.string().optional(),
  day_of_week: z.coerce.number().min(0).max(6),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Invalid start time (HH:MM)"),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Invalid end time (HH:MM)"),
});

export const ResourceUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(3, "Resource name must be at least 3 characters"),
  description: z.string().optional().nullable(),
  category: z.enum(["lab", "room", "equipment", "computing", "media"]),
  location: z.string().min(2, "Location is required"),
  image_path: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  requires_supervision: z.boolean().default(false),
  max_duration_hours: z.coerce.number().min(1).max(24),
  buffer_minutes: z.coerce.number().min(0).max(120),
  usage_rules: z.string().optional().nullable(),
  deposit_note: z.string().optional().nullable(),
  requirements: z.array(ResourceRequirementSchema).default([]),
  availability_windows: z.array(AvailabilityWindowSchema).default([]),
  manager_ids: z.array(z.string().uuid()).default([]),
});

export type ResourceUpsertInput = z.infer<typeof ResourceUpsertSchema>;
