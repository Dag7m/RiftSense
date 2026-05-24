"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Activity, MapPinned, Users, Waves } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/event-card";
import { EmptyState } from "@/components/empty-state";
import { StatTiles } from "@/components/stat-tiles";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchEventStats,
  fetchRecentEvents,
  fetchRecentFeltReports,
} from "@/lib/queries";

const EventsMap = dynamic(
  () => import("@/components/maps/events-map").then((m) => m.EventsMap),
  { ssr: false, loading: () => <Skeleton className="h-[420px] w-full" /> },
);
const FeltReportsMap = dynamic(
  () =>
    import("@/components/maps/felt-reports-map").then(
      (m) => m.FeltReportsMap,
    ),
  { ssr: false, loading: () => <Skeleton className="h-[420px] w-full" /> },
);

import { useSocket } from "@/components/providers/socket-provider";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function HomePage() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  React.useEffect(() => {
    if (!socket) return;

    socket.on("seismic_event", (event: any) => {
      console.log("Real-time event received:", event);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["events"] });
      
      if (event.type === "new") {
        toast.error("NEW SEISMIC EVENT DETECTED!", {
          description: `Location: ${event.latitude}, ${event.longitude}. Confidence: ${(event.confidence * 100).toFixed(1)}%`,
          duration: 10000,
        });
      }
    });

    return () => {
      socket.off("seismic_event");
    };
  }, [socket, queryClient]);

  const statsQuery = useQuery({
    queryKey: ["events", "stats"],
    queryFn: fetchEventStats,
  });

  const recentEventsQuery = useQuery({
    queryKey: ["events", "recent", { hours: 24, limit: 12 }],
    queryFn: () => fetchRecentEvents(24, 12),
  });

  const recentReportsQuery = useQuery({
    queryKey: ["felt", "recent", { limit: 50 }],
    queryFn: () => fetchRecentFeltReports(50),
  });

  const stats = statsQuery.data ?? {};
  const tiles = [
    {
      label: "Total events",
      value: stats.total_events ?? "-",
      icon: <Activity className="h-4 w-4" />,
    },
    {
      label: "Confirmed",
      value: stats.confirmed_earthquakes ?? stats.confirmed ?? "-",
      icon: <Waves className="h-4 w-4" />,
    },
    {
      label: "Last 24h",
      value: stats.last_24h ?? "-",
      icon: <MapPinned className="h-4 w-4" />,
    },
    {
      label: "Felt reports",
      value: recentReportsQuery.data?.length ?? "-",
      icon: <Users className="h-4 w-4" />,
    },
  ];

  return (
    <div className="container space-y-10 py-8">
      <section className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Community-powered seismic monitoring
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            RiftSense ingests vibration data from a distributed network of
            sensors, detects events, and lets people share what they felt.
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/events">Browse events</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/reports">View felt reports</Link>
          </Button>
        </div>
      </section>

      <section>
        <StatTiles tiles={tiles} loading={statsQuery.isLoading} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent events</h2>
          <Button asChild variant="link">
            <Link href="/events">View all</Link>
          </Button>
        </div>
        {recentEventsQuery.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : recentEventsQuery.data && recentEventsQuery.data.length > 0 ? (
          <>
            <EventsMap events={recentEventsQuery.data} />
            <div className="grid gap-3 md:grid-cols-2">
              {recentEventsQuery.data.slice(0, 6).map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title="No recent events"
            description="When the sensor network detects activity, events will appear here."
            icon={<Activity className="h-6 w-6" />}
          />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent felt reports</h2>
          <Button asChild variant="link">
            <Link href="/reports">Open reports</Link>
          </Button>
        </div>
        {recentReportsQuery.isLoading ? (
          <Skeleton className="h-[420px] w-full" />
        ) : recentReportsQuery.data && recentReportsQuery.data.length > 0 ? (
          <FeltReportsMap reports={recentReportsQuery.data} />
        ) : (
          <EmptyState
            title="No felt reports yet"
            description="Be the first to share what you felt during an event."
            icon={<Users className="h-6 w-6" />}
          />
        )}
      </section>
    </div>
  );
}
