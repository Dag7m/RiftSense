"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Marker, useMap, useMapEvents } from "react-leaflet";

const MapBase = dynamic(
  () => import("@/components/maps/map-base").then((m) => m.MapBase),
  { ssr: false, loading: () => <div className="h-full w-full bg-muted" /> },
);

interface MapPickerProps {
  latitude?: number;
  longitude?: number;
  onChange: (lat: number, lon: number) => void;
  height?: number;
}

function ClickHandler({
  onChange,
}: {
  onChange: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click: (e) => {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ lat, lon }: { lat?: number; lon?: number }) {
  const map = useMap();
  React.useEffect(() => {
    if (typeof lat === "number" && typeof lon === "number") {
      map.flyTo([lat, lon], Math.max(map.getZoom(), 8), { duration: 0.5 });
    }
  }, [lat, lon, map]);
  return null;
}

export function MapPicker({
  latitude,
  longitude,
  onChange,
  height = 320,
}: MapPickerProps) {
  const center: [number, number] =
    typeof latitude === "number" && typeof longitude === "number"
      ? [latitude, longitude]
      : [20, 0];

  return (
    <div style={{ height }} className="overflow-hidden rounded-lg border">
      <MapBase center={center} zoom={center[0] === 20 && center[1] === 0 ? 2 : 8}>
        <ClickHandler onChange={onChange} />
        <Recenter lat={latitude} lon={longitude} />
        {typeof latitude === "number" && typeof longitude === "number" && (
          <Marker position={[latitude, longitude]} />
        )}
      </MapBase>
    </div>
  );
}
