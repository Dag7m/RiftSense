"use client";

import * as React from "react";
import { Bell } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth";
import { fetchMyNotifications, markAllNotificationsRead } from "@/lib/queries";

export function NotificationBell() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ["notifications", "mine", "unread-count"],
    queryFn: async () => {
      const rows = await fetchMyNotifications({ unread: true, limit: 50 });
      return rows.length;
    },
    enabled: Boolean(user?.id),
    refetchInterval: 5000,
  });

  const unread = notificationsQuery.data ?? 0;

  if (!user) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Notifications"
      onClick={async () => {
        await markAllNotificationsRead();
        await qc.invalidateQueries({ queryKey: ["notifications"] });
      }}
      className="relative"
      title={
        unread > 0
          ? `${unread} unread notification(s). Click to mark all read.`
          : "No new notifications"
      }
    >
      <Bell className="h-5 w-5" />
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-semibold text-destructive-foreground">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Button>
  );
}

