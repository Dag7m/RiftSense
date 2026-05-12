"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { NodeForm } from "@/components/node-form";
import { NodeStatusBadge } from "@/components/node-status-badge";
import { fetchNodes } from "@/lib/queries";
import { formatLatLng, relativeFromNow } from "@/lib/formatters";

const NodeMap = dynamic(
  () => import("@/components/maps/node-map").then((m) => m.NodeMap),
  { ssr: false, loading: () => <Skeleton className="h-[360px] w-full" /> },
);

export default function AdminNodesPage() {
  const nodesQuery = useQuery({
    queryKey: ["sensor", "nodes"],
    queryFn: fetchNodes,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sensor nodes</h1>
          <p className="text-sm text-muted-foreground">
            Install and monitor your distributed sensors.
          </p>
        </div>
        <NodeForm />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Map</CardTitle>
        </CardHeader>
        <CardContent>
          {nodesQuery.isLoading ? (
            <Skeleton className="h-[360px] w-full" />
          ) : (nodesQuery.data ?? []).length === 0 ? (
            <EmptyState
              title="No sensor nodes registered"
              description="Use the Install node button to add the first one."
            />
          ) : (
            <NodeMap nodes={nodesQuery.data ?? []} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All nodes</CardTitle>
        </CardHeader>
        <CardContent>
          {nodesQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (nodesQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No nodes yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Node ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last heartbeat</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(nodesQuery.data ?? []).map((node) => (
                  <TableRow key={node.id}>
                    <TableCell className="font-mono text-xs">
                      {node.node_id}
                    </TableCell>
                    <TableCell>{node.name}</TableCell>
                    <TableCell className="text-xs">
                      {formatLatLng(node.latitude, node.longitude)}
                    </TableCell>
                    <TableCell>
                      <NodeStatusBadge status={node.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {relativeFromNow(node.last_heartbeat)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="link" size="sm">
                        <Link href={`/admin/nodes/${node.node_id}`}>
                          Open
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
