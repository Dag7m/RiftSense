"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { CircleMarker, Popup } from "react-leaflet";

import { relativeFromNow, toNumber } from "@/lib/formatters";
import type { FeltReport } from "@/lib/types";

const MapBase = dynamic(
  () => import("@/components/maps/map-base").then((m) => m.MapBase),
  { ssr: false, loading: () => <div className="h-full w-full bg-muted" /> },
);

function intensityColor(level: number): string {
  if (level >= 9) return "#dc2626";
  if (level >= 7) return "#ea580c";
  if (level >= 5) return "#f59e0b";
  if (level >= 3) return "#facc15";
  return "#10b981";
}

interface FeltReportsMapProps {
  reports: FeltReport[];
  height?: number | string;
}

export function FeltReportsMap({ reports, height = 420 }: FeltReportsMapProps) {
  const valid = reports.filter((r) => r.latitude && r.longitude);

  const center =
    valid.length > 0
      ? ([toNumber(valid[0].latitude), toNumber(valid[0].longitude)] as [
          number,
          number,
        ])
      : ([20, 0] as [number, number]);

  return (
    <div style={{ height }} className="overflow-hidden rounded-lg border">
      <MapBase center={center} zoom={valid.length === 1 ? 6 : 2}>
        {valid.map((r) => {
          const lat = toNumber(r.latitude);
          const lon = toNumber(r.longitude);
          return (
            <CircleMarker
              key={r.id}
              center={[lat, lon]}
              radius={6 + Math.min(8, r.intensity)}
              pathOptions={{
                color: intensityColor(r.intensity),
                fillColor: intensityColor(r.intensity),
                fillOpacity: 0.5,
                weight: 1.2,
              }}
            >
              <Popup>
                <div className="space-y-1 text-xs">
                  <div className="font-semibold">Intensity {r.intensity}</div>
                  {r.description && <div>{r.description}</div>}
                  <div className="text-muted-foreground">
                    {relativeFromNow(r.reported_at)}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapBase>
    </div>
  );
}
