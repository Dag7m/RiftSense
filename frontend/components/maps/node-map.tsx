"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { CircleMarker, Popup } from "react-leaflet";

import {
  NODE_STATUS_LABEL,
  formatLatLng,
  relativeFromNow,
  toNumber,
} from "@/lib/formatters";
import type { SensorNode } from "@/lib/types";

const MapBase = dynamic(
  () => import("@/components/maps/map-base").then((m) => m.MapBase),
  { ssr: false, loading: () => <div className="h-full w-full bg-muted" /> },
);

function nodeColor(node: SensorNode): string {
  if (node.status === "active") return "#10b981";
  if (node.status === "maintenance") return "#f59e0b";
  return "#64748b";
}

interface NodeMapProps {
  nodes: SensorNode[];
  height?: number | string;
}

export function NodeMap({ nodes, height = 360 }: NodeMapProps) {
  const valid = nodes.filter((n) => n.latitude && n.longitude);
  const center =
    valid.length > 0
      ? ([toNumber(valid[0].latitude), toNumber(valid[0].longitude)] as [
          number,
          number,
        ])
      : ([20, 0] as [number, number]);

  return (
    <div style={{ height }} className="overflow-hidden rounded-lg border">
      <MapBase center={center} zoom={valid.length === 1 ? 8 : 3}>
        {valid.map((node) => {
          const lat = toNumber(node.latitude);
          const lon = toNumber(node.longitude);
          return (
            <CircleMarker
              key={node.id}
              center={[lat, lon]}
              radius={8}
              pathOptions={{
                color: nodeColor(node),
                fillColor: nodeColor(node),
                fillOpacity: 0.6,
                weight: 1.5,
              }}
            >
              <Popup>
                <div className="space-y-1 text-xs">
                  <div className="font-semibold">{node.name}</div>
                  <div>ID: {node.node_id}</div>
                  <div>Status: {NODE_STATUS_LABEL[node.status]}</div>
                  <div>{formatLatLng(node.latitude, node.longitude)}</div>
                  <div>Last heartbeat: {relativeFromNow(node.last_heartbeat)}</div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapBase>
    </div>
  );
}
