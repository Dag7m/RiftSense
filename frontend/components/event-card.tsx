import Link from "next/link";
import { MapPin, Activity } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { EventStatusBadge } from "@/components/event-status-badge";
import {
  EVENT_TYPE_LABEL,
  formatLatLng,
  formatMagnitude,
  magnitudeColor,
  relativeFromNow,
} from "@/lib/formatters";
import type { SeismicEvent } from "@/lib/types";

interface EventCardProps {
  event: SeismicEvent;
}

export function EventCard({ event }: EventCardProps) {
  return (
    <Link href={`/events/${event.id}`}>
      <Card className="transition-colors hover:bg-accent/40">
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted ${magnitudeColor(event.magnitude_estimate)}`}
            >
              <span className="text-lg font-semibold">
                {event.magnitude_estimate
                  ? formatMagnitude(event.magnitude_estimate)
                  : "—"}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {EVENT_TYPE_LABEL[event.event_type] ?? event.event_type}
                </span>
                <EventStatusBadge status={event.status} />
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {formatLatLng(event.latitude, event.longitude)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5" />
                  {event.detection_count ?? 0} detection(s)
                </span>
              </div>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {relativeFromNow(event.detected_at)}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
