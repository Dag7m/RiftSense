"use client";

import * as React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Skeleton } from "@/components/ui/skeleton";
import { toNumber } from "@/lib/formatters";
import type { SensorDataPoint } from "@/lib/types";

interface WaveformChartProps {
  data: SensorDataPoint[];
  loading?: boolean;
  height?: number;
  showMagnitudeOnly?: boolean;
}

interface ChartRow {
  t: number;
  label: string;
  x: number;
  y: number;
  z: number;
  m: number;
}

function buildRows(points: SensorDataPoint[]): ChartRow[] {
  return points
    .map((p) => {
      const t = new Date(p.time).getTime();
      return {
        t,
        label: new Date(p.time).toLocaleTimeString(),
        x: toNumber(p.x_axis),
        y: toNumber(p.y_axis),
        z: toNumber(p.z_axis),
        m: toNumber(p.magnitude),
      };
    })
    .sort((a, b) => a.t - b.t);
}

export function WaveformChart({
  data,
  loading,
  height = 240,
  showMagnitudeOnly = false,
}: WaveformChartProps) {
  const rows = React.useMemo(() => buildRows(data ?? []), [data]);

  if (loading) {
    return <Skeleton style={{ height }} className="w-full" />;
  }

  if (!rows.length) {
    return (
      <div
        style={{ height }}
        className="flex w-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground"
      >
        No samples in this window.
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={rows}
          margin={{ top: 5, right: 16, bottom: 5, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            minTickGap={32}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            width={50}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {!showMagnitudeOnly && (
            <>
              <Line
                type="monotone"
                dataKey="x"
                stroke="#3b82f6"
                dot={false}
                isAnimationActive={false}
                strokeWidth={1.4}
              />
              <Line
                type="monotone"
                dataKey="y"
                stroke="#10b981"
                dot={false}
                isAnimationActive={false}
                strokeWidth={1.4}
              />
              <Line
                type="monotone"
                dataKey="z"
                stroke="#f59e0b"
                dot={false}
                isAnimationActive={false}
                strokeWidth={1.4}
              />
            </>
          )}
          <Line
            type="monotone"
            dataKey="m"
            name="magnitude"
            stroke="#ef4444"
            dot={false}
            isAnimationActive={false}
            strokeWidth={showMagnitudeOnly ? 1.8 : 1.4}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
