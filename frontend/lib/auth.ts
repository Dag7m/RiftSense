import { create } from "zustand";
import { jwtDecode } from "jwt-decode";
import axios from "axios";

import { unwrapUser } from "@/lib/response";
import type { AuthTokens, User } from "@/lib/types";

const STORAGE_KEY = "riftsense.auth";
const baseURL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isHydrated: boolean;

  setTokens: (tokens: AuthTokens) => void;
  setUser: (user: User | null) => void;
  clear: () => void;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
}

interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  user: User | null;
}

function persist(state: Partial<StoredAuth> | null) {
  if (typeof window === "undefined") return;
  if (!state) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function readPersisted(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    return null;
  }
}

interface JwtPayload {
  sub?: string;
  id?: string;
  userId?: string;
  email?: string;
  role?: string;
  name?: string;
  exp?: number;
}

function userFromToken(token: string): User | null {
  try {
    const payload = jwtDecode<JwtPayload>(token);
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return {
      id: payload.sub ?? payload.id ?? payload.userId ?? "",
      email: payload.email ?? "",
      name: payload.name ?? null,
      role: (payload.role as User["role"]) ?? "user",
    };
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isHydrated: false,

  setTokens: ({ accessToken, refreshToken }) => {
    const decoded = userFromToken(accessToken);
    set((prev) => ({
      accessToken,
      refreshToken,
      user: decoded
        ? { ...(prev.user ?? {}), ...decoded } as User
        : prev.user,
    }));
    persist({
      accessToken,
      refreshToken,
      user: get().user,
    });
  },

  setUser: (user) => {
    set({ user });
    const { accessToken, refreshToken } = get();
    if (accessToken && refreshToken) {
      persist({ accessToken, refreshToken, user });
    }
  },

  clear: () => {
    set({ accessToken: null, refreshToken: null, user: null });
    persist(null);
  },

  hydrate: async () => {
    const stored = readPersisted();
    if (!stored) {
      set({ isHydrated: true });
      return;
    }

    const decoded = userFromToken(stored.accessToken);
    set({
      accessToken: stored.accessToken,
      refreshToken: stored.refreshToken,
      user: stored.user ?? decoded,
      isHydrated: true,
    });

    try {
      const response = await axios.get(`${baseURL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${stored.accessToken}` },
      });
      const fetchedUser = unwrapUser(response.data);
      if (fetchedUser?.id) {
        set({ user: fetchedUser });
        persist({
          accessToken: stored.accessToken,
          refreshToken: stored.refreshToken,
          user: fetchedUser,
        });
      }
    } catch {
      // Stale token; interceptor will refresh on next protected request.
    }
  },

  logout: async () => {
    const token = get().accessToken;
    try {
      if (token) {
        await axios.post(
          `${baseURL}/api/auth/logout`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        );
      }
    } catch {
      // ignore logout failure
    }
    get().clear();
  },
}));
