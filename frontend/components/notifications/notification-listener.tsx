"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuthStore } from "@/lib/auth";
import { fetchMyNotifications } from "@/lib/queries";

export function NotificationListener() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  // In-app popup: toast each unread notification once per page session.
  // (If the user refreshes and notifications are still unread, they can toast again.)
  const seenIdsRef = React.useRef<Set<string>>(new Set());

  useQuery({
    queryKey: ["notifications", "mine", "unread"],
    queryFn: () => fetchMyNotifications({ unread: true, limit: 20 }),
    enabled: Boolean(user?.id),
    refetchInterval: 5000,
    onSuccess: (rows) => {
      const seen = seenIdsRef.current;
      const toToast = rows.filter((n) => !seen.has(n.id));
      if (toToast.length === 0) return;

      toToast
        .slice()
        .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
        .forEach((n) => {
          seen.add(n.id);
          toast.warning(n.title || "Earthquake alert", {
            description: n.message,
            duration: 10000,
          });
        });

      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return null;
}

