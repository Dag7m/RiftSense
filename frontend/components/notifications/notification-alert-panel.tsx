"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/lib/auth";
import { fetchMyNotifications, markNotificationRead } from "@/lib/queries";

export function NotificationAlertPanel() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const unreadQuery = useQuery({
    queryKey: ["notifications", "mine", "unread-latest"],
    queryFn: async () => {
      const rows = await fetchMyNotifications({ unread: true, limit: 5 });
      return rows;
    },
    enabled: Boolean(user?.id),
    refetchInterval: 5000,
  });

  const latest = unreadQuery.data?.[0];

  const dismiss = useMutation({
    mutationFn: async () => {
      if (!latest) return null;
      return await markNotificationRead(latest.id);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  if (!user?.id) return null;
  if (!latest) return null;

  return (
    <div className="fixed right-4 top-20 z-50 w-[360px] max-w-[calc(100vw-2rem)]">
      <Card className="border-destructive/40 bg-background/95 shadow-lg backdrop-blur">
        <CardContent className="flex gap-3 p-4">
          <div className="mt-0.5 shrink-0 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold leading-5">
              {latest.title || "Earthquake alert"}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {latest.message}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => dismiss.mutate()}
                disabled={dismiss.isPending}
              >
                {dismiss.isPending ? "Dismissing…" : "Dismiss"}
              </Button>
              {latest.event_id ? (
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                >
                  <a href={`/events/${latest.event_id}`}>View event</a>
                </Button>
              ) : null}
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="-mr-1 -mt-1 h-8 w-8"
            aria-label="Dismiss notification"
            onClick={() => dismiss.mutate()}
            disabled={dismiss.isPending}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

