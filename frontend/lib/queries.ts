import {
  api,
  normalizeAuthTokens,
  unwrap,
  unwrapPaginatedList,
  unwrapUser,
} from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import type {
  AuthTokens,
  EventCreateInput,
  EventStatusUpdateInput,
  FeltReport,
  FeltReportInput,
  NodeCreateInput,
  Pagination,
  SeismicEvent,
  SensorDataPoint,
  SensorNode,
  User,
} from "@/lib/types";

// ---------- Auth ----------

export interface AuthSession {
  user: User;
  tokens: AuthTokens;
}

export async function loginRequest(input: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  const { data } = await api.post("/api/auth/login", input);
  const payload = unwrap<{ user: User } & Record<string, unknown>>(data);
  return { user: payload.user, tokens: normalizeAuthTokens(payload) };
}

export async function registerRequest(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<AuthSession> {
  const { data } = await api.post("/api/auth/register", input);
  const payload = unwrap<{ user: User } & Record<string, unknown>>(data);
  return { user: payload.user, tokens: normalizeAuthTokens(payload) };
}

export async function fetchMe(): Promise<User> {
  const cached = useAuthStore.getState().user;
  try {
    const { data } = await api.get("/api/auth/me");
    return unwrapUser(data);
  } catch (error) {
    if (cached?.id && cached.email) return cached;
    throw error;
  }
}

export async function updateMe(input: { name?: string; email?: string }) {
  const { data } = await api.put("/api/auth/me", input);
  return unwrapUser(data);
}

export async function changePasswordRequest(input: {
  currentPassword: string;
  newPassword: string;
}) {
  const { data } = await api.put("/api/auth/password", input);
  return data;
}

// ---------- Events ----------

export interface EventListParams {
  page?: number;
  limit?: number;
  status?: string;
  event_type?: string;
  start_date?: string;
  end_date?: string;
  min_confidence?: number;
}

export async function fetchEvents(params: EventListParams = {}) {
  const { data } = await api.get("/api/events", { params });
  const payload = unwrap<{
    events?: SeismicEvent[];
    pagination?: Pagination;
  }>(data) as
    | { events: SeismicEvent[]; pagination: Pagination }
    | SeismicEvent[];
  if (Array.isArray(payload)) {
    return { events: payload, pagination: undefined };
  }
  return {
    events: payload.events ?? [],
    pagination: payload.pagination,
  };
}

export async function fetchRecentEvents(hours = 24, limit = 50) {
  const { data } = await api.get("/api/events/recent", {
    params: { hours, limit },
  });
  const payload = unwrap<SeismicEvent[] | { events: SeismicEvent[] }>(data);
  if (Array.isArray(payload)) return payload;
  return payload.events ?? [];
}

export async function fetchEventStats() {
  const { data } = await api.get("/api/events/stats");
  return unwrap<Record<string, number>>(data);
}

export async function fetchEvent(id: string) {
  const { data } = await api.get(`/api/events/${id}`);
  return unwrap<SeismicEvent>(data);
}

export async function fetchEventDetections(id: string) {
  const { data } = await api.get(`/api/events/${id}/detections`);
  const payload = unwrap<
    | SeismicEvent["detections"]
    | { detections?: SeismicEvent["detections"] }
  >(data);
  if (Array.isArray(payload)) return payload ?? [];
  return payload?.detections ?? [];
}

export async function fetchNearbyEvents(params: {
  latitude: number;
  longitude: number;
  radius_km?: number;
  limit?: number;
}) {
  const { data } = await api.get("/api/events/nearby", { params });
  const payload = unwrap<SeismicEvent[] | { events: SeismicEvent[] }>(data);
  if (Array.isArray(payload)) return payload;
  return payload.events ?? [];
}

export async function createEvent(input: EventCreateInput) {
  const { data } = await api.post("/api/events", input);
  return unwrap<SeismicEvent>(data);
}

export async function updateEventStatus(
  id: string,
  input: EventStatusUpdateInput,
) {
  const { data } = await api.put(`/api/events/${id}/status`, input);
  return unwrap<SeismicEvent>(data);
}

export async function deleteEvent(id: string) {
  const { data } = await api.delete(`/api/events/${id}`);
  return data;
}

// ---------- Sensor nodes & data (admin) ----------

export async function fetchNodes() {
  const { data } = await api.get("/api/sensors/nodes");
  const payload = unwrap<
    SensorNode[] | { nodes: SensorNode[] }
  >(data);
  if (Array.isArray(payload)) return payload;
  return payload.nodes ?? [];
}

export async function fetchNode(nodeId: string) {
  const { data } = await api.get(`/api/sensors/nodes/${nodeId}`);
  return unwrap<SensorNode>(data);
}

export async function fetchSensorData(
  nodeId: string,
  params: {
    start_time?: string;
    end_time?: string;
    limit?: number;
    minutes?: number;
  } = {},
) {
  const { data } = await api.get(`/api/sensors/data/${nodeId}`, { params });
  const payload = unwrap<
    | SensorDataPoint[]
    | {
        readings?: SensorDataPoint[];
        data?: SensorDataPoint[];
        points?: SensorDataPoint[];
      }
  >(data);
  if (Array.isArray(payload)) return payload;
  return payload.readings ?? payload.data ?? payload.points ?? [];
}

export async function fetchSensorAggregates(
  nodeId: string,
  params: { hours?: number; interval?: string } = {},
) {
  const { data } = await api.get(`/api/sensors/data/${nodeId}/aggregates`, {
    params,
  });
  const payload = unwrap<
    | Array<Record<string, number | string>>
    | { aggregates?: Array<Record<string, number | string>> }
  >(data);
  if (Array.isArray(payload)) return payload;
  return payload.aggregates ?? [];
}

export async function createNode(input: NodeCreateInput) {
  const body = {
    ...input,
    elevation: Number.isFinite(input.elevation as number)
      ? input.elevation
      : undefined,
    firmware_version: input.firmware_version || undefined,
  };
  const { data } = await api.post("/api/admin/nodes", body);
  return unwrap<SensorNode>(data);
}

// ---------- Felt reports ----------

export async function fetchIntensityScale() {
  const { data } = await api.get("/api/felt/intensity-scale");
  return unwrap<{ scale: string; levels: Array<{ level: number; description: string }> }>(data);
}

export async function fetchRecentFeltReports(limit = 20) {
  const { data } = await api.get("/api/felt/recent", { params: { limit } });
  const payload = unwrap<FeltReport[] | { reports: FeltReport[] }>(data);
  if (Array.isArray(payload)) return payload;
  return payload.reports ?? [];
}

export async function fetchNearbyFeltReports(params: {
  latitude: number;
  longitude: number;
  radius_km?: number;
  limit?: number;
}) {
  const { data } = await api.get("/api/felt/nearby", { params });
  const payload = unwrap<FeltReport[] | { reports: FeltReport[] }>(data);
  if (Array.isArray(payload)) return payload;
  return payload.reports ?? [];
}

export async function fetchFeltReportsForEvent(eventId: string) {
  const { data } = await api.get(`/api/felt/event/${eventId}`);
  const payload = unwrap<FeltReport[] | { reports: FeltReport[] }>(data);
  if (Array.isArray(payload)) return payload;
  return payload.reports ?? [];
}

export async function fetchFeltStats() {
  const { data } = await api.get("/api/felt/stats");
  return unwrap<Record<string, unknown>>(data);
}

export async function submitFeltReport(input: FeltReportInput) {
  const body = {
    latitude: input.latitude,
    longitude: input.longitude,
    intensity: input.intensity,
    description: input.description || undefined,
    event_id: input.event_id || undefined,
    is_anonymous: input.is_anonymous,
  };
  const { data } = await api.post("/api/felt", body);
  return unwrap<FeltReport>(data);
}

export async function deleteFeltReport(id: string) {
  const { data } = await api.delete(`/api/felt/${id}`);
  return data;
}

// ---------- Admin ----------

export async function fetchAdminDashboard() {
  const { data } = await api.get("/api/admin/dashboard");
  return unwrap<Record<string, unknown>>(data);
}

export async function fetchAdminStats(period = "7d") {
  const { data } = await api.get("/api/admin/stats", { params: { period } });
  return unwrap<Record<string, unknown>>(data);
}

export async function fetchAdminUsers(params: { page?: number; limit?: number } = {}) {
  const { data } = await api.get("/api/admin/users", { params });
  const { items, pagination } = unwrapPaginatedList<User>(data);
  return {
    users: items,
    pagination: pagination ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      total: items.length,
    },
  };
}

export async function updateAdminUser(
  id: string,
  input: { role?: "user" | "admin"; is_active?: boolean; name?: string },
) {
  const { data } = await api.put(`/api/admin/users/${id}`, input);
  return unwrap<User>(data);
}

export async function deactivateAdminUser(id: string) {
  const { data } = await api.delete(`/api/admin/users/${id}`);
  return data;
}

export async function fetchAuditLogs(params: { page?: number; limit?: number } = {}) {
  const { data } = await api.get("/api/admin/logs", { params });
  type AuditLog = {
    id: string;
    admin_id?: string;
    action: string;
    resource_type: string;
    resource_id?: string;
    created_at: string;
    details?: Record<string, unknown>;
  };
  const { items, pagination } = unwrapPaginatedList<AuditLog>(data);
  return {
    logs: items,
    pagination: pagination ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 50,
      total: items.length,
    },
  };
}

export async function fetchRecentAdminActivity() {
  const { data } = await api.get("/api/admin/logs/recent");
  const payload = unwrap<
    | Array<Record<string, unknown>>
    | { activity?: Array<Record<string, unknown>> }
  >(data);
  if (Array.isArray(payload)) return payload;
  return payload.activity ?? [];
}

export async function fetchDatabaseInfo() {
  const { data } = await api.get("/api/admin/database");
  return unwrap<Record<string, unknown>>(data);
}

export async function runDatabaseCleanup(input: {
  older_than_days: number;
  tables?: string[];
}) {
  const { data } = await api.post("/api/admin/cleanup", input);
  return unwrap<Record<string, unknown>>(data);
}
