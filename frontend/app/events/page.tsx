"use client";

import * as React from "react";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { EventCard } from "@/components/event-card";
import { Pagination } from "@/components/pagination";
import { fetchEvents } from "@/lib/queries";

const EventsMap = dynamic(
  () => import("@/components/maps/events-map").then((m) => m.EventsMap),
  { ssr: false, loading: () => <Skeleton className="h-[420px] w-full" /> },
);

function readNumber(value: string | null, fallback?: number) {
  if (!value) return fallback;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function EventsPageRoute() {
  return (
    <Suspense fallback={null}>
      <EventsPage />
    </Suspense>
  );
}

function EventsPage() {
  const router = useRouter();
  const params = useSearchParams();

  const page = readNumber(params.get("page"), 1)!;
  const limit = 20;
  const status = params.get("status") ?? undefined;
  const eventType = params.get("event_type") ?? undefined;
  const startDate = params.get("start_date") ?? undefined;
  const endDate = params.get("end_date") ?? undefined;
  const minConfidence = readNumber(params.get("min_confidence"));

  const eventsQuery = useQuery({
    queryKey: [
      "events",
      "list",
      { page, limit, status, eventType, startDate, endDate, minConfidence },
    ],
    queryFn: () =>
      fetchEvents({
        page,
        limit,
        status,
        event_type: eventType,
        start_date: startDate,
        end_date: endDate,
        min_confidence: minConfidence,
      }),
  });

  const setQuery = (next: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (v === undefined || v === "" || v === "any") {
        sp.delete(k);
      } else {
        sp.set(k, v);
      }
    });
    if (!("page" in next)) sp.set("page", "1");
    router.replace(`/events?${sp.toString()}`);
  };

  const totalPages =
    eventsQuery.data?.pagination?.totalPages ??
    eventsQuery.data?.pagination?.pages ??
    1;

  return (
    <div className="container space-y-6 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Events</h1>
        <p className="text-sm text-muted-foreground">
          Browse detected seismic events. Use filters to narrow the list.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status ?? "any"}
                onValueChange={(v) => setQuery({ status: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="false_positive">False positive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={eventType ?? "any"}
                onValueChange={(v) => setQuery({ event_type: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="earthquake">Earthquake</SelectItem>
                  <SelectItem value="noise">Noise</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input
                type="date"
                value={startDate ?? ""}
                onChange={(e) =>
                  setQuery({ start_date: e.target.value || undefined })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input
                type="date"
                value={endDate ?? ""}
                onChange={(e) =>
                  setQuery({ end_date: e.target.value || undefined })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Min confidence</Label>
              <Input
                type="number"
                step="0.05"
                min={0}
                max={1}
                value={params.get("min_confidence") ?? ""}
                onChange={(e) =>
                  setQuery({ min_confidence: e.target.value || undefined })
                }
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setQuery({
                  status: undefined,
                  event_type: undefined,
                  start_date: undefined,
                  end_date: undefined,
                  min_confidence: undefined,
                })
              }
            >
              Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {eventsQuery.isLoading ? (
        <Skeleton className="h-[420px] w-full" />
      ) : eventsQuery.data && eventsQuery.data.events.length > 0 ? (
        <EventsMap events={eventsQuery.data.events} />
      ) : null}

      {eventsQuery.isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : eventsQuery.data && eventsQuery.data.events.length > 0 ? (
        <div className="grid gap-3">
          {eventsQuery.data.events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No events match these filters"
          description="Try clearing one or more filters or widening the date range."
        />
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={(p) => setQuery({ page: String(p) })}
      />
    </div>
  );
}
