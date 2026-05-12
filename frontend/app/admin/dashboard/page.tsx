"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Activity, Radio, Users, Waves } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatTiles } from "@/components/stat-tiles";
import { EmptyState } from "@/components/empty-state";
import {
  fetchAdminDashboard,
  fetchAdminStats,
  fetchNodes,
  fetchRecentAdminActivity,
  fetchRecentEvents,
} from "@/lib/queries";
import { EventCard } from "@/components/event-card";
import { formatDateTime, relativeFromNow } from "@/lib/formatters";

const NodeMap = dynamic(
  () => import("@/components/maps/node-map").then((m) => m.NodeMap),
  { ssr: false, loading: () => <Skeleton className="h-[360px] w-full" /> },
);

function pickNumber(...values: unknown[]): number | string {
  for (const v of values) {
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.length > 0) return v;
  }
  return "-";
}

export default function AdminDashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: fetchAdminDashboard,
  });
  const statsQuery = useQuery({
    queryKey: ["admin", "stats", "7d"],
    queryFn: () => fetchAdminStats("7d"),
  });
  const nodesQuery = useQuery({
    queryKey: ["sensor", "nodes"],
    queryFn: fetchNodes,
  });
  const recentEventsQuery = useQuery({
    queryKey: ["events", "recent", { hours: 24, limit: 10 }],
    queryFn: () => fetchRecentEvents(24, 10),
  });
  const activityQuery = useQuery({
    queryKey: ["admin", "logs", "recent"],
    queryFn: fetchRecentAdminActivity,
  });

  const dashboard = (dashboardQuery.data ?? {}) as Record<string, any>;
  const stats = (statsQuery.data ?? {}) as Record<string, any>;
  const summary = dashboard.summary ?? {};

  const tiles = [
    {
      label: "Active nodes",
      value: pickNumber(summary.active_nodes, stats?.nodes?.active),
      icon: <Radio className="h-4 w-4" />,
      hint: `${pickNumber(summary.total_nodes, stats?.nodes?.total)} total`,
    },
    {
      label: "Total events",
      value: pickNumber(summary.total_events, stats?.events?.total),
      icon: <Activity className="h-4 w-4" />,
      hint: `${pickNumber(summary.pending_events, stats?.events?.pending)} pending`,
    },
    {
      label: "Confirmed events",
      value: pickNumber(stats?.events?.confirmed),
      icon: <Waves className="h-4 w-4" />,
    },
    {
      label: "Felt reports",
      value: pickNumber(summary.total_reports, stats?.reports?.total),
      icon: <Users className="h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Network health and recent activity at a glance.
        </p>
      </div>

      <StatTiles tiles={tiles} loading={dashboardQuery.isLoading} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Node map</CardTitle>
          </CardHeader>
          <CardContent>
            {nodesQuery.isLoading ? (
              <Skeleton className="h-[360px] w-full" />
            ) : nodesQuery.data && nodesQuery.data.length > 0 ? (
              <NodeMap nodes={nodesQuery.data} />
            ) : (
              <EmptyState
                title="No sensor nodes registered"
                description="Use the Nodes page to install your first node."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activityQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (activityQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recent admin activity.
              </p>
            ) : (
              <ul className="space-y-3">
                {(activityQuery.data ?? []).slice(0, 8).map((item: any) => (
                  <li
                    key={item.id ?? item.created_at}
                    className="text-sm leading-snug"
                  >
                    <div className="font-medium">
                      {item.action}{" "}
                      <Badge variant="outline" className="ml-1 align-middle">
                        {item.resource_type}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {relativeFromNow(item.created_at)} ·{" "}
                      {formatDateTime(item.created_at)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent events</CardTitle>
        </CardHeader>
        <CardContent>
          {recentEventsQuery.isLoading ? (
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (recentEventsQuery.data ?? []).length === 0 ? (
            <EmptyState
              title="No recent events"
              description="Events from the network will appear here."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {(recentEventsQuery.data ?? []).slice(0, 6).map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
