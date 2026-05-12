"use client";

import * as React from "react";
import L from "leaflet";
import { Marker } from "react-leaflet";

import { toNumber } from "@/lib/formatters";

function rippleColor(m: number): string {
  if (m >= 6) return "rgba(220, 38, 38, 0.85)";
  if (m >= 4) return "rgba(234, 88, 12, 0.85)";
  if (m >= 2) return "rgba(217, 119, 6, 0.85)";
  return "rgba(16, 185, 129, 0.85)";
}

interface RippleMarkerProps {
  lat: number;
  lng: number;
  magnitude?: number | string | null;
}

/**
 * Decorative ripple overlay placed on top of a CircleMarker. It uses a Leaflet
 * `divIcon` so we can animate it with CSS, and is non-interactive so clicks
 * still hit the underlying CircleMarker.
 */
export function RippleMarker({ lat, lng, magnitude }: RippleMarkerProps) {
  const icon = React.useMemo(() => {
    const m = toNumber(magnitude);
    const size = Math.min(140, Math.max(48, 36 + m * 14));
    const color = rippleColor(m);
    return L.divIcon({
      className: "eq-ripple-icon",
      html: `
        <div class="eq-ripple-container" style="--ripple-color:${color}; width:${size}px; height:${size}px;">
          <span class="eq-ripple-ring" style="animation-delay:0s"></span>
          <span class="eq-ripple-ring" style="animation-delay:0.6s"></span>
          <span class="eq-ripple-ring" style="animation-delay:1.2s"></span>
          <span class="eq-ripple-core"></span>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }, [magnitude]);

  return (
    <Marker
      position={[lat, lng]}
      icon={icon}
      interactive={false}
      keyboard={false}
    />
  );
}
