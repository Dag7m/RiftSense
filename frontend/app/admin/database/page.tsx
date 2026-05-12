"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Database, Trash2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiErrorMessage } from "@/lib/api";
import { fetchDatabaseInfo, runDatabaseCleanup } from "@/lib/queries";

const TABLES = [
  "sensor_data",
  "predictions",
  "admin_logs",
  "felt_reports",
] as const;

export default function AdminDatabasePage() {
  const queryClient = useQueryClient();
  const [olderThanDays, setOlderThanDays] = React.useState("90");
  const [selected, setSelected] = React.useState<string[]>(["sensor_data"]);

  const dbQuery = useQuery({
    queryKey: ["admin", "database"],
    queryFn: fetchDatabaseInfo,
  });

  const cleanup = useMutation({
    mutationFn: runDatabaseCleanup,
    onSuccess: (data) => {
      toast.success(
        typeof data?.deleted_records === "number"
          ? `Cleanup complete (${data.deleted_records} rows)`
          : "Cleanup complete",
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "database"] });
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, "Cleanup failed")),
  });

  const dbInfo = (dbQuery.data ?? {}) as any;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Database</h1>
        <p className="text-sm text-muted-foreground">
          Inspect storage and prune old data.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" />
            Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dbQuery.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Database</div>
                <div className="text-sm font-medium">
                  {dbInfo.database?.name ?? "-"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {dbInfo.database?.version ?? ""}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">TimescaleDB</div>
                <div className="text-sm font-medium">
                  {dbInfo.timescaledb?.version ?? "-"}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(dbInfo.timescaledb?.hypertables ?? []).map((h: any) => (
                    <Badge key={h.name} variant="outline">
                      {h.name} · {h.chunks ?? 0} chunks
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trash2 className="h-4 w-4" />
            Cleanup
          </CardTitle>
          <CardDescription>
            Delete rows older than the threshold from the selected tables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="older">Older than (days)</Label>
              <Input
                id="older"
                type="number"
                min={1}
                value={olderThanDays}
                onChange={(e) => setOlderThanDays(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tables</Label>
              <div className="flex flex-wrap gap-2">
                {TABLES.map((t) => {
                  const checked = selected.includes(t);
                  return (
                    <button
                      type="button"
                      key={t}
                      onClick={() =>
                        setSelected((curr) =>
                          checked
                            ? curr.filter((x) => x !== t)
                            : [...curr, t],
                        )
                      }
                      className={
                        "rounded-full border px-3 py-1 text-xs transition " +
                        (checked
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-accent")
                      }
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={cleanup.isPending || !selected.length}
              >
                {cleanup.isPending ? "Cleaning…" : "Run cleanup"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Run database cleanup?</AlertDialogTitle>
                <AlertDialogDescription>
                  Rows older than {olderThanDays} days will be removed from{" "}
                  {selected.join(", ")}. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    cleanup.mutate({
                      older_than_days: parseInt(olderThanDays, 10),
                      tables: selected,
                    })
                  }
                >
                  Run cleanup
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
