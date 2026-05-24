import { Badge } from "@/components/ui/badge";
import { NODE_STATUS_LABEL } from "@/lib/formatters";
import type { NodeStatus } from "@/lib/types";

const VARIANT_MAP: Record<NodeStatus, "success" | "secondary" | "warning"> = {
  active: "success",
  inactive: "secondary",
  maintenance: "warning",
};

export function NodeStatusBadge({ status }: { status: NodeStatus }) {
  return (
    <Badge variant={VARIANT_MAP[status] ?? "secondary"}>
      {NODE_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
