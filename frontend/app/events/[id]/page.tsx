"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Activity, MapPin, Waves } from "lucide-react";
import { addSeconds, parseISO } from "date-fns";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventStatusBadge } from "@/components/event-status-badge";
import { WaveformChart } from "@/components/waveform-chart";
import { StatTiles } from "@/components/stat-tiles";
import { EmptyState } from "@/components/empty-state";
import {
  EVENT_TYPE_LABEL,
  formatDateTime,
  formatLatLng,
  formatMagnitude,
  formatConfidence,
  intensityColor,
  magnitudeColor,
  relativeFromNow,
} from "@/lib/formatters";
import { useAuthStore } from "@/lib/auth";
import {
  fetchEvent,
  fetchEventDetections,
  fetchFeltReportsForEvent,
  fetchSensorData,
} from "@/lib/queries";
import type { EventDetection } from "@/lib/types";

const WAVEFORM_WINDOW_SECONDS = 30;

function DetectionWaveform({
  detection,
  enabled,
}: {
  detection: EventDetection;
  enabled: boolean;
}) {
  const dataQuery = useQuery({
    enabled,
    queryKey: ["sensor", "window", detection.id],
    queryFn: () => {
      const center = parseISO(detection.detection_time);
      const start = addSeconds(center, -WAVEFORM_WINDOW_SECONDS).toISOString();
      const end = addSeconds(center, WAVEFORM_WINDOW_SECONDS).toISOString();
      return fetchSensorData(
        detection.sensor_node_id ?? detection.node_id,
        { start_time: start, end_time: end, limit: 1000 },
      );
    },
  });

  if (!enabled) {
    return (
      <EmptyState
        title="Sign in as admin to load waveforms"
        description="Sensor data endpoints require admin privileges."
        icon={<Waves className="h-5 w-5" />}
        className="py-8"
      />
    );
  }

  if (dataQuery.isLoading) return <Skeleton className="h-48 w-full" />;
  if (dataQuery.isError)
    return (
      <p className="text-sm text-destructive">
        Could not load samples for this node.
      </p>
    );

  return (
    <WaveformChart data={dataQuery.data ?? []} showMagnitudeOnly={false} />
  );
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const isAdmin = useAuthStore((s) => s.user?.role === "admin");

  const eventQuery = useQuery({
    enabled: !!id,
    queryKey: ["event", id],
    queryFn: () => fetchEvent(id),
  });

  const detectionsQuery = useQuery({
    enabled: !!id,
    queryKey: ["event", id, "detections"],
    queryFn: () => fetchEventDetections(id),
  });

  const reportsQuery = useQuery({
    enabled: !!id,
    queryKey: ["event", id, "felt"],
    queryFn: () => fetchFeltReportsForEvent(id),
  });

  if (eventQuery.isLoading) {
    return (
      <div className="container space-y-4 py-8">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!eventQuery.data) {
    return (
      <div className="container py-12">
        <EmptyState
          title="Event not found"
          description="It may have been deleted, or the link is incorrect."
        />
      </div>
    );
  }

  const event = eventQuery.data;
  const detections =
    detectionsQuery.data ??
    (event.detections as EventDetection[] | undefined) ??
    [];
  const reports = reportsQuery.data ?? [];

  const intensities = reports.map((r) => r.intensity);
  const avgIntensity =
    intensities.length > 0
      ? (intensities.reduce((a, b) => a + b, 0) / intensities.length).toFixed(1)
      : "-";
  const maxIntensity = intensities.length > 0 ? Math.max(...intensities) : "-";

  const tiles = [
    {
      label: "Magnitude",
      value: (
        <span className={magnitudeColor(event.magnitude_estimate)}>
          {event.magnitude_estimate
            ? formatMagnitude(event.magnitude_estimate)
            : "-"}
        </span>
      ),
      icon: <Activity className="h-4 w-4" />,
    },
    {
      label: "Confidence",
      value: formatConfidence(event.confidence),
      icon: <Waves className="h-4 w-4" />,
    },
    {
      label: "Detections",
      value: detections.length || event.detection_count || 0,
      icon: <MapPin className="h-4 w-4" />,
    },
    {
      label: "Felt reports",
      value: reports.length || event.felt_report_count || 0,
      icon: <MapPin className="h-4 w-4" />,
    },
  ];

  return (
    <div className="container space-y-6 py-8">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {EVENT_TYPE_LABEL[event.event_type] ?? event.event_type}
          </h1>
          <EventStatusBadge status={event.status} />
          <Badge variant="outline">
            {formatLatLng(event.latitude, event.longitude)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Detected {formatDateTime(event.detected_at)} ({" "}
          {relativeFromNow(event.detected_at)} ){event.description ? " — " : ""}
          {event.description}
        </p>
      </div>

      <StatTiles tiles={tiles} />

      <Tabs defaultValue="detections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="detections">
            Detections ({detections.length})
          </TabsTrigger>
          <TabsTrigger value="reports">
            Felt reports ({reports.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="detections" className="space-y-4">
          {detections.length === 0 ? (
            <EmptyState
              title="No detections recorded"
              description="This event has no per-node detection rows."
            />
          ) : (
            detections.map((d) => (
              <Card key={d.id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {d.sensor_name ?? d.sensor_node_id ?? d.node_id}
                    <Badge variant="outline">
                      {formatDateTime(d.detection_time)}
                    </Badge>
                    <Badge variant="secondary">
                      peak {formatMagnitude(d.peak_acceleration)}
                    </Badge>
                    {d.sta_lta_ratio && (
                      <Badge variant="secondary">
                        STA/LTA {formatMagnitude(d.sta_lta_ratio)}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {d.node_latitude && d.node_longitude
                      ? `Node at ${formatLatLng(d.node_latitude, d.node_longitude)}`
                      : null}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DetectionWaveform detection={d} enabled={isAdmin} />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Community impact</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <div className="text-xs text-muted-foreground">
                  Average intensity
                </div>
                <div className="text-2xl font-semibold">{avgIntensity}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Max intensity</div>
                <div className="text-2xl font-semibold">{maxIntensity}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total reports</div>
                <div className="text-2xl font-semibold">{reports.length}</div>
              </div>
            </CardContent>
          </Card>

          {reports.length === 0 ? (
            <EmptyState
              title="No felt reports for this event yet"
              description="People can submit felt-it reports linked to this event."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {reports.map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold ${intensityColor(r.intensity)}`}
                      >
                        {r.intensity}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {r.description || "(no description)"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatLatLng(r.latitude, r.longitude)} ·{" "}
                          {relativeFromNow(r.reported_at)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
