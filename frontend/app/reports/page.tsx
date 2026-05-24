"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MapPin, MessageSquareText, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  formatLatLng,
  intensityColor,
  relativeFromNow,
} from "@/lib/formatters";
import {
  fetchIntensityScale,
  fetchNearbyFeltReports,
  fetchRecentFeltReports,
} from "@/lib/queries";

const FeltReportsMap = dynamic(
  () =>
    import("@/components/maps/felt-reports-map").then((m) => m.FeltReportsMap),
  { ssr: false, loading: () => <Skeleton className="h-[420px] w-full" /> },
);

export default function ReportsPage() {
  const recentQuery = useQuery({
    queryKey: ["felt", "recent", { limit: 50 }],
    queryFn: () => fetchRecentFeltReports(50),
  });

  const scaleQuery = useQuery({
    queryKey: ["felt", "intensity-scale"],
    queryFn: fetchIntensityScale,
  });

  const [coords, setCoords] = React.useState<{ lat: string; lon: string; radius: string }>({
    lat: "",
    lon: "",
    radius: "100",
  });

  const nearbyQuery = useQuery({
    enabled:
      !!parseFloat(coords.lat) &&
      !!parseFloat(coords.lon) &&
      !!parseFloat(coords.radius),
    queryKey: ["felt", "nearby", coords],
    queryFn: () =>
      fetchNearbyFeltReports({
        latitude: parseFloat(coords.lat),
        longitude: parseFloat(coords.lon),
        radius_km: parseFloat(coords.radius),
        limit: 100,
      }),
  });

  const reports = nearbyQuery.data ?? recentQuery.data ?? [];

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setCoords((prev) => ({
        ...prev,
        lat: pos.coords.latitude.toFixed(6),
        lon: pos.coords.longitude.toFixed(6),
      }));
    });
  };

  return (
    <div className="container space-y-6 py-8">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Felt reports</h1>
          <p className="text-sm text-muted-foreground">
            Reports submitted by people across the network.
          </p>
        </div>
        <Button asChild>
          <Link href="/felt-it">Submit a report</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Find reports near a location</CardTitle>
          <CardDescription>
            Leave the fields empty to see the most recent global reports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Latitude</Label>
              <Input
                value={coords.lat}
                onChange={(e) =>
                  setCoords((c) => ({ ...c, lat: e.target.value }))
                }
                placeholder="-90..90"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Longitude</Label>
              <Input
                value={coords.lon}
                onChange={(e) =>
                  setCoords((c) => ({ ...c, lon: e.target.value }))
                }
                placeholder="-180..180"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Radius (km)</Label>
              <Input
                value={coords.radius}
                onChange={(e) =>
                  setCoords((c) => ({ ...c, radius: e.target.value }))
                }
              />
            </div>
            <div className="flex items-end gap-2">
              <Button type="button" variant="outline" onClick={useMyLocation}>
                <MapPin className="h-4 w-4" />
                Use my location
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCoords({ lat: "", lon: "", radius: "100" })}
              >
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {recentQuery.isLoading ? (
        <Skeleton className="h-[420px] w-full" />
      ) : reports.length > 0 ? (
        <FeltReportsMap reports={reports} />
      ) : null}

      {reports.length === 0 && !recentQuery.isLoading ? (
        <EmptyState
          title="No reports to show"
          description="Try widening the radius or check back after the next event."
          icon={<Users className="h-6 w-6" />}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {reports.slice(0, 30).map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold ${intensityColor(r.intensity)}`}
                  >
                    {r.intensity}
                  </div>
                  <div className="flex-1">
                    <div className="line-clamp-3 text-sm">
                      {r.description || "(no description)"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareText className="h-4 w-4" />
            Intensity reference
          </CardTitle>
          <CardDescription>
            {scaleQuery.data?.scale ?? "Modified Mercalli Intensity"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scaleQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-5">
              {(scaleQuery.data?.levels ?? []).map((lvl) => (
                <li
                  key={lvl.level}
                  className="flex items-center gap-2 rounded-md border p-2 text-xs"
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full font-semibold ${intensityColor(lvl.level)}`}
                  >
                    {lvl.level}
                  </span>
                  <span>{lvl.description}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
