"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Radio, Waves } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NodeStatusBadge } from "@/components/node-status-badge";
import { WaveformChart } from "@/components/waveform-chart";
import { EmptyState } from "@/components/empty-state";
import {
  fetchNode,
  fetchSensorAggregates,
  fetchSensorData,
} from "@/lib/queries";
import {
  formatDateTime,
  formatLatLng,
  relativeFromNow,
} from "@/lib/formatters";
import type { SensorDataPoint } from "@/lib/types";

import { useSocket } from "@/components/providers/socket-provider";
import type { SensorDataPoint } from "@/lib/types";

const PULL_LIMIT = 600;

function useSensorSocket(nodeId: string) {
  const { socket, isConnected } = useSocket();
  const [data, setData] = React.useState<SensorDataPoint[]>([]);

  React.useEffect(() => {
    if (!socket || !nodeId) return;

    socket.emit("subscribe", nodeId);

    const handleData = (newData: any) => {
      // Handle both single points and batches
      if (newData.batch) {
        setData((prev) => [...prev, ...newData.batch].slice(-PULL_LIMIT));
      } else {
        setData((prev) => [...prev, newData].slice(-PULL_LIMIT));
      }
    };

    socket.on("sensor_data", handleData);

    return () => {
      socket.emit("unsubscribe", nodeId);
      socket.off("sensor_data", handleData);
    };
  }, [socket, nodeId]);

  return { 
    data, 
    isConnected,
    isLoading: false, 
    isError: false 
  };
}

export default function AdminNodeDetailPage() {
  const params = useParams<{ node_id: string }>();
  const nodeId = params.node_id;
  const [hours, setHours] = React.useState<number>(1);

  const nodeQuery = useQuery({
    enabled: !!nodeId,
    queryKey: ["sensor", "node", nodeId],
    queryFn: () => fetchNode(nodeId),
  });

  const liveQuery = useSensorSocket(nodeId);

  const aggregatesQuery = useQuery({
    enabled: !!nodeId,
    queryKey: ["sensor", "aggregates", nodeId, hours],
    queryFn: () => fetchSensorAggregates(nodeId, { hours }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/nodes">
            <ChevronLeft className="h-4 w-4" />
            Back to nodes
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-lg">
            <Radio className="h-5 w-5" />
            {nodeQuery.data?.name ?? nodeId}
            {nodeQuery.data && <NodeStatusBadge status={nodeQuery.data.status} />}
          </CardTitle>
          <CardDescription>
            {nodeQuery.data
              ? `${nodeQuery.data.node_id} · ${formatLatLng(nodeQuery.data.latitude, nodeQuery.data.longitude)}`
              : "Loading…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Firmware</div>
            <div>{nodeQuery.data?.firmware_version ?? "-"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Battery</div>
            <div>
              {nodeQuery.data?.battery_level != null
                ? `${nodeQuery.data.battery_level}%`
                : "-"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Last heartbeat</div>
            <div>
              {relativeFromNow(nodeQuery.data?.last_heartbeat)} ·{" "}
              <span className="text-muted-foreground">
                {formatDateTime(nodeQuery.data?.last_heartbeat)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Waves className="h-4 w-4" />
            Live waveform (last 60s)
          </CardTitle>
          <CardDescription>
            Polled every {POLL_INTERVAL}ms. Magnitude in red, x/y/z in blue/green/amber.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {liveQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : liveQuery.isError ? (
            <EmptyState
              title="Could not load sensor data"
              description="Make sure the node is registered and streaming."
            />
          ) : (liveQuery.data ?? []).length === 0 ? (
            <EmptyState
              title="No samples in the last 60s"
              description=""
            />
          ) : (
            <WaveformChart data={liveQuery.data ?? []} height={280} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aggregates</CardTitle>
          <CardDescription>
            Rolling magnitude statistics. Choose the window below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Select
              value={String(hours)}
              onValueChange={(v) => setHours(Number(v))}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 1 hour</SelectItem>
                <SelectItem value="6">Last 6 hours</SelectItem>
                <SelectItem value="24">Last 24 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {aggregatesQuery.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (aggregatesQuery.data ?? []).length === 0 ? (
            <EmptyState
              title="No aggregates"
              description="There is not enough data for this window yet."
            />
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Bucket</th>
                    <th className="py-2 pr-4">Avg magnitude</th>
                    <th className="py-2 pr-4">Max magnitude</th>
                    <th className="py-2 pr-4">Min magnitude</th>
                    <th className="py-2 pr-4">Samples</th>
                  </tr>
                </thead>
                <tbody>
                  {(aggregatesQuery.data ?? []).map((row, i) => (
                    <tr key={i} className="border-t">
                      <td className="py-2 pr-4">
                        {formatDateTime((row.bucket as string) ?? (row.time as string))}
                      </td>
                      <td className="py-2 pr-4">{row.avg_magnitude as string}</td>
                      <td className="py-2 pr-4">{row.max_magnitude as string}</td>
                      <td className="py-2 pr-4">{row.min_magnitude as string}</td>
                      <td className="py-2 pr-4">{row.sample_count as string}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
