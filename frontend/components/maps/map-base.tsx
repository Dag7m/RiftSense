"use client";

import * as React from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import L from "leaflet";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";

import { cn } from "@/lib/utils";

// Fix default marker icon URLs (webpack does not resolve them automatically).
const ICON_BASE = "https://unpkg.com/leaflet@1.9.4/dist/images";
L.Icon.Default.mergeOptions({
  iconRetinaUrl: `${ICON_BASE}/marker-icon-2x.png`,
  iconUrl: `${ICON_BASE}/marker-icon.png`,
  shadowUrl: `${ICON_BASE}/marker-shadow.png`,
});

interface MapBaseProps {
  center?: LatLngExpression;
  zoom?: number;
  bounds?: LatLngBoundsExpression;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function MapBase({
  center = [20, 0],
  zoom = 2,
  bounds,
  className,
  style,
  children,
}: MapBaseProps) {
  return (
    <div className={cn("map-shell relative isolate z-0 h-full w-full", className)}>
      <MapContainer
        center={center}
        zoom={zoom}
        bounds={bounds}
        scrollWheelZoom
        className="h-full w-full"
        style={{ height: "100%", width: "100%", ...style }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {children}
      </MapContainer>
    </div>
  );
}
