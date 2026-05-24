"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";

import { useAuthStore } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";

interface AuthGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function AuthGuard({ children, requireAdmin = false }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isHydrated } = useAuthStore((s) => ({
    user: s.user,
    isHydrated: s.isHydrated,
  }));

  React.useEffect(() => {
    if (!isHydrated) return;
    if (!user) {
      const next = encodeURIComponent(pathname ?? "/");
      router.replace(`/login?next=${next}`);
      return;
    }
    if (requireAdmin && user.role !== "admin") {
      router.replace("/403");
    }
  }, [isHydrated, user, requireAdmin, router, pathname]);

  if (!isHydrated || !user || (requireAdmin && user.role !== "admin")) {
    return (
      <div className="container py-10 space-y-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return <>{children}</>;
}
