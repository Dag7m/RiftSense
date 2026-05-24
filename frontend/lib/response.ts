import type { AuthTokens, Pagination, User } from "@/lib/types";

/** Unwrap the standard `{ success, data }` response envelope. */
export function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in (payload as object)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

/**
 * Backend list endpoints often return `{ success, data: T[], pagination }`
 * with `pagination` at the root (not inside `data`).
 */
export function unwrapPaginatedList<T>(payload: unknown): {
  items: T[];
  pagination?: Pagination;
} {
  if (!payload || typeof payload !== "object") {
    return { items: [] };
  }

  const body = payload as {
    data?: T[] | Record<string, unknown>;
    pagination?: Pagination;
  };

  if (Array.isArray(body.data)) {
    return { items: body.data, pagination: body.pagination };
  }

  if (body.data && typeof body.data === "object") {
    const nested = body.data as Record<string, unknown>;
    const listKey = ["users", "logs", "events", "items", "nodes", "reports"].find(
      (key) => Array.isArray(nested[key]),
    );
    if (listKey) {
      return {
        items: nested[listKey] as T[],
        pagination: (nested.pagination as Pagination | undefined) ?? body.pagination,
      };
    }
  }

  return { items: [], pagination: body.pagination };
}

/** Extract a user from `/api/auth/me` (and similar) response shapes. */
export function unwrapUser(payload: unknown): User {
  const data = unwrap<{ user?: User } | User>(payload);
  if (data && typeof data === "object") {
    if ("user" in data && data.user) return data.user;
    if ("id" in data && "email" in data) return data;
  }
  throw new Error("Invalid user response");
}

/**
 * Map backend auth fields (`token`, `refreshToken`) to the frontend `AuthTokens` shape.
 */
export function normalizeAuthTokens(raw: unknown): AuthTokens {
  const data =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!data) {
    throw new Error("Invalid auth response");
  }

  const nested =
    data.tokens && typeof data.tokens === "object"
      ? (data.tokens as Record<string, unknown>)
      : null;
  const source = nested ?? data;

  const accessToken =
    (source.accessToken as string | undefined) ??
    (source.access_token as string | undefined) ??
    (source.token as string | undefined) ??
    (data.token as string | undefined);
  const refreshToken =
    (source.refreshToken as string | undefined) ??
    (source.refresh_token as string | undefined) ??
    (data.refreshToken as string | undefined);

  if (!accessToken || !refreshToken) {
    throw new Error("Invalid auth response: missing tokens");
  }

  return { accessToken, refreshToken };
}
