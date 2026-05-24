import axios, { AxiosError, type AxiosRequestConfig } from "axios";

import { useAuthStore } from "@/lib/auth";

const baseURL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

/**
 * Single in-flight refresh promise so concurrent 401s queue behind one refresh.
 */
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const store = useAuthStore.getState();
  const refreshToken = store.refreshToken;
  if (!refreshToken) return null;

  try {
    const response = await axios.post(`${baseURL}/api/auth/refresh`, {
      refreshToken,
    });
    const data = response.data?.data ?? response.data;
    const tokens = data?.tokens ?? data;
    const newAccess: string | undefined = tokens?.accessToken ?? tokens?.access_token;
    const newRefresh: string =
      tokens?.refreshToken ?? tokens?.refresh_token ?? refreshToken;

    if (!newAccess) return null;
    store.setTokens({ accessToken: newAccess, refreshToken: newRefresh });
    return newAccess;
  } catch {
    store.clear();
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (AxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (!original || error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    const url = original.url ?? "";
    if (url.includes("/api/auth/login") || url.includes("/api/auth/refresh")) {
      return Promise.reject(error);
    }

    original._retry = true;
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const newToken = await refreshPromise;
    if (!newToken) {
      if (typeof window !== "undefined") {
        const next = encodeURIComponent(window.location.pathname);
        window.location.href = `/login?next=${next}`;
      }
      return Promise.reject(error);
    }

    original.headers = original.headers ?? {};
    (original.headers as Record<string, string>)[
      "Authorization"
    ] = `Bearer ${newToken}`;
    return api.request(original);
  },
);

/** Extract a friendly error message from an axios error. */
export function apiErrorMessage(error: unknown, fallback = "Request failed") {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: string; message?: string; errors?: Array<{ message: string }> }
      | undefined;
    if (data?.error) return data.error;
    if (data?.message) return data.message;
    if (data?.errors?.length) return data.errors.map((e) => e.message).join(", ");
    return error.message;
  }
  return fallback;
}

/** Unwrap the standard `{ success, data }` response envelope. */
export function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in (payload as object)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}
