"use client";

import * as React from "react";
import { useAuthStore } from "@/lib/auth";

/**
 * Rehydrates auth tokens from localStorage on the client once on mount, and
 * fetches the current user when an access token exists.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);

  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

  return <>{children}</>;
}
