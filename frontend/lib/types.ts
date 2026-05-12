import { z } from "zod";

export type Role = "user" | "admin";

export interface User {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  is_active?: boolean;
  created_at?: string;
  last_login?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type EventType = "earthquake" | "noise" | "unknown";
export type EventStatus = "pending" | "confirmed" | "false_positive";

export interface SeismicEvent {
  id: string;
  event_type: EventType;
  confidence: number | string;
  magnitude_estimate?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  depth_km?: number | string | null;
  detected_at: string;
  status: EventStatus;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
  detection_count?: number;
  felt_report_count?: number;
  detections?: EventDetection[];
}

export interface EventDetection {
  id: string;
  event_id: string;
  node_id: string;
  sensor_node_id?: string;
  sensor_name?: string;
  detection_time: string;
  peak_acceleration: number | string;
  sta_lta_ratio?: number | string | null;
  distance_from_epicenter?: number | string | null;
  p_wave_arrival?: string | null;
  s_wave_arrival?: string | null;
  node_latitude?: number | string;
  node_longitude?: number | string;
}

export type NodeStatus = "active" | "inactive" | "maintenance";

export interface SensorNode {
  id: string;
  node_id: string;
  name: string;
  latitude: number | string;
  longitude: number | string;
  elevation?: number | string | null;
  status: NodeStatus;
  last_heartbeat?: string | null;
  battery_level?: number | null;
  firmware_version?: string | null;
  created_at?: string;
}

export interface SensorDataPoint {
  time: string;
  x_axis: number | string;
  y_axis: number | string;
  z_axis: number | string;
  magnitude: number | string;
  sampling_rate?: number;
}

export interface FeltReport {
  id: string;
  user_id?: string | null;
  event_id?: string | null;
  latitude: number | string;
  longitude: number | string;
  intensity: number;
  description?: string | null;
  is_anonymous: boolean;
  reported_at: string;
  created_at?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages?: number;
  totalPages?: number;
}

// ---------- Zod schemas ----------

export const LoginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  name: z.string().min(1, "Enter your name").max(255).optional(),
  email: z.string().email("Enter a valid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const ProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
});
export type ProfileInput = z.infer<typeof ProfileSchema>;

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export const FeltReportSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  intensity: z.coerce.number().int().min(1).max(10),
  description: z
    .string()
    .max(1000, "Description too long")
    .optional()
    .or(z.literal("")),
  event_id: z.string().uuid().optional().or(z.literal("")),
  is_anonymous: z.boolean().default(false),
});
export type FeltReportInput = z.infer<typeof FeltReportSchema>;

export const NodeCreateSchema = z.object({
  node_id: z
    .string()
    .min(3)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, "Letters, numbers, dashes, underscores only"),
  name: z.string().min(1).max(255),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  elevation: z.coerce.number().min(-500).max(10000).optional().or(z.nan()),
  status: z.enum(["active", "inactive", "maintenance"]).default("active"),
  firmware_version: z.string().max(50).optional().or(z.literal("")),
});
export type NodeCreateInput = z.infer<typeof NodeCreateSchema>;

export const EventCreateSchema = z.object({
  event_type: z.enum(["earthquake", "noise", "unknown"]).default("earthquake"),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  magnitude_estimate: z.coerce.number().optional().or(z.nan()),
  depth_km: z.coerce.number().optional().or(z.nan()),
  detected_at: z.string().optional(),
  description: z.string().max(1000).optional().or(z.literal("")),
});
export type EventCreateInput = z.infer<typeof EventCreateSchema>;

export const EventStatusUpdateSchema = z.object({
  status: z.enum(["pending", "confirmed", "false_positive"]),
  event_type: z.enum(["earthquake", "noise", "unknown"]).optional(),
  description: z.string().max(1000).optional().or(z.literal("")),
});
export type EventStatusUpdateInput = z.infer<typeof EventStatusUpdateSchema>;
