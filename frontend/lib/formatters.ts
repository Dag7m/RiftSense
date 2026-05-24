import { format, formatDistanceToNow, parseISO } from "date-fns";

import type { EventStatus, EventType, NodeStatus } from "@/lib/types";

export function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  try {
    return format(parseISO(value), "yyyy-MM-dd HH:mm:ss");
  } catch {
    return value;
  }
}

export function formatDate(value?: string | null): string {
  if (!value) return "-";
  try {
    return format(parseISO(value), "yyyy-MM-dd");
  } catch {
    return value;
  }
}

export function relativeFromNow(value?: string | null): string {
  if (!value) return "-";
  try {
    return formatDistanceToNow(parseISO(value), { addSuffix: true });
  } catch {
    return value;
  }
}

export function formatLatLng(
  lat?: number | string | null,
  lon?: number | string | null,
): string {
  const a = toNumber(lat);
  const b = toNumber(lon);
  if (!lat || !lon) return "-";
  return `${a.toFixed(4)}, ${b.toFixed(4)}`;
}

export function formatMagnitude(value?: number | string | null): string {
  if (value === undefined || value === null) return "-";
  return toNumber(value).toFixed(2);
}

export function formatConfidence(value?: number | string | null): string {
  if (value === undefined || value === null) return "-";
  const n = toNumber(value);
  return `${(n * 100).toFixed(0)}%`;
}

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  earthquake: "Earthquake",
  noise: "Noise",
  unknown: "Unknown",
};

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  false_positive: "False positive",
};

export const NODE_STATUS_LABEL: Record<NodeStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  maintenance: "Maintenance",
};

export function magnitudeColor(value?: number | string | null): string {
  const n = toNumber(value);
  if (n >= 6) return "text-red-600 dark:text-red-400";
  if (n >= 4) return "text-orange-600 dark:text-orange-400";
  if (n >= 2) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

export function intensityColor(level?: number | null): string {
  if (level === null || level === undefined) return "bg-muted";
  if (level >= 9) return "bg-red-600 text-white";
  if (level >= 7) return "bg-orange-500 text-white";
  if (level >= 5) return "bg-amber-500 text-black";
  if (level >= 3) return "bg-yellow-300 text-black";
  return "bg-emerald-300 text-black";
}
