"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import { fetchAuditLogs } from "@/lib/queries";
import { formatDateTime, relativeFromNow } from "@/lib/formatters";

export default function AdminAuditPage() {
  const [page, setPage] = React.useState(1);
  const logsQuery = useQuery({
    queryKey: ["admin", "logs", { page }],
    queryFn: () => fetchAuditLogs({ page, limit: 50 }),
  });

  const totalPages =
    logsQuery.data?.pagination?.totalPages ??
    logsQuery.data?.pagination?.pages ??
    1;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Audit logs</h1>
        <p className="text-sm text-muted-foreground">
          Every admin action is recorded here.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {logsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (logsQuery.data?.logs ?? []).length === 0 ? (
            <EmptyState
              title="No audit entries"
              description="Actions taken in this console will show up here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Resource ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(logsQuery.data?.logs ?? []).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">
                      <div>{formatDateTime(log.created_at)}</div>
                      <div className="text-muted-foreground">
                        {relativeFromNow(log.created_at)}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.admin_id ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.action}</Badge>
                    </TableCell>
                    <TableCell>{log.resource_type}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.resource_id ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
