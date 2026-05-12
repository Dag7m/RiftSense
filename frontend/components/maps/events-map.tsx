"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CircleMarker, Popup } from "react-leaflet";

import { toNumber, formatMagnitude, EVENT_TYPE_LABEL } from "@/lib/formatters";
import type { SeismicEvent } from "@/lib/types";
import { RippleMarker } from "@/components/maps/ripple-marker";

const MapBase = dynamic(
  () => import("@/components/maps/map-base").then((m) => m.MapBase),
  { ssr: false, loading: () => <div className="h-full w-full bg-muted" /> },
);

const DEFAULT_RIPPLE_WINDOW_MS = 24 * 60 * 60 * 1000;

function isRippleEvent(event: SeismicEvent, windowMs: number): boolean {
  if (event.event_type !== "earthquake") return false;
  if (event.status === "false_positive") return false;
  if (!event.detected_at) return false;
  const ts = new Date(event.detected_at).getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= windowMs;
}

function magnitudeRadius(value?: number | string | null): number {
  const m = toNumber(value);
  if (!m) return 6;
  return Math.min(20, Math.max(5, m * 2.5));
}

function magnitudeFill(value?: number | string | null): string {
  const m = toNumber(value);
  if (m >= 6) return "#dc2626";
  if (m >= 4) return "#ea580c";
  if (m >= 2) return "#d97706";
  return "#10b981";
}

interface EventsMapProps {
  events: SeismicEvent[];
  height?: number | string;
  /**
   * Earthquakes detected within this many milliseconds get an animated water
   * ripple. Defaults to 24h; pass `Infinity` to ripple every earthquake.
   */
  rippleWindowMs?: number;
}

export function EventsMap({
  events,
  height = 420,
  rippleWindowMs = DEFAULT_RIPPLE_WINDOW_MS,
}: EventsMapProps) {
  const valid = events.filter((e) => e.latitude && e.longitude);

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
        {valid.map((event) => {
          const lat = toNumber(event.latitude);
          const lon = toNumber(event.longitude);
          const ripple = isRippleEvent(event, rippleWindowMs);
          return (
            <React.Fragment key={event.id}>
              {ripple && (
                <RippleMarker
                  lat={lat}
                  lng={lon}
                  magnitude={event.magnitude_estimate}
                />
              )}
              <CircleMarker
                center={[lat, lon]}
                radius={magnitudeRadius(event.magnitude_estimate)}
                pathOptions={{
                  color: magnitudeFill(event.magnitude_estimate),
                  fillColor: magnitudeFill(event.magnitude_estimate),
                  fillOpacity: 0.5,
                  weight: 1.5,
                }}
              >
                <Popup>
                  <div className="space-y-1 text-xs">
                    <div className="font-semibold">
                      {EVENT_TYPE_LABEL[event.event_type] ?? event.event_type}
                    </div>
                    <div>
                      Magnitude: {formatMagnitude(event.magnitude_estimate)}
                    </div>
                    <div>Status: {event.status}</div>
                    <div>
                      {lat.toFixed(4)}, {lon.toFixed(4)}
                    </div>
                    <Link
                      href={`/events/${event.id}`}
                      className="block text-primary underline"
                    >
                      Open event
                    </Link>
                  </div>
                </Popup>
              </CircleMarker>
            </React.Fragment>
          );
        })}
      </MapBase>
    </div>
  );
}
