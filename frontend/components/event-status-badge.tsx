import { Badge } from "@/components/ui/badge";
import { EVENT_STATUS_LABEL } from "@/lib/formatters";
import type { EventStatus } from "@/lib/types";

const VARIANT_MAP: Record<EventStatus, "warning" | "success" | "secondary"> = {
  pending: "warning",
  confirmed: "success",
  false_positive: "secondary",
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return (
    <Badge variant={VARIANT_MAP[status] ?? "secondary"}>
      {EVENT_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
