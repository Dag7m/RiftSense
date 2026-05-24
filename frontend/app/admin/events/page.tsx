"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal, Plus, Trash } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EventStatusBadge } from "@/components/event-status-badge";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import { apiErrorMessage } from "@/lib/api";
import {
  createEvent,
  deleteEvent,
  fetchEvents,
  updateEventStatus,
} from "@/lib/queries";
import {
  EVENT_TYPE_LABEL,
  formatDateTime,
  formatLatLng,
  formatConfidence,
  formatMagnitude,
} from "@/lib/formatters";
import {
  EventCreateSchema,
  type EventCreateInput,
  type EventStatus,
} from "@/lib/types";

function CreateEventDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);

  const form = useForm<EventCreateInput>({
    resolver: zodResolver(EventCreateSchema),
    defaultValues: {
      event_type: "earthquake",
      latitude: 0,
      longitude: 0,
      magnitude_estimate: undefined,
      depth_km: undefined,
      description: "",
      detected_at: new Date().toISOString().slice(0, 16),
    },
  });

  const mutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      toast.success("Event created");
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setOpen(false);
      form.reset();
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, "Could not create event")),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Manual event
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create event</DialogTitle>
          <DialogDescription>
            Manually log an event. It will be marked as confirmed.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((values) =>
            mutation.mutate({
              ...values,
              detected_at: values.detected_at
                ? new Date(values.detected_at).toISOString()
                : undefined,
              description: values.description || undefined,
              magnitude_estimate: Number.isFinite(values.magnitude_estimate)
                ? values.magnitude_estimate
                : undefined,
              depth_km: Number.isFinite(values.depth_km)
                ? values.depth_km
                : undefined,
            }),
          )}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.watch("event_type")}
                onValueChange={(v) =>
                  form.setValue("event_type", v as EventCreateInput["event_type"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="earthquake">Earthquake</SelectItem>
                  <SelectItem value="noise">Noise</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Detected at</Label>
              <Input
                type="datetime-local"
                {...form.register("detected_at")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Latitude</Label>
              <Input
                type="number"
                step="any"
                {...form.register("latitude", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Longitude</Label>
              <Input
                type="number"
                step="any"
                {...form.register("longitude", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Magnitude</Label>
              <Input
                type="number"
                step="any"
                {...form.register("magnitude_estimate", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Depth (km)</Label>
              <Input
                type="number"
                step="any"
                {...form.register("depth_km", { valueAsNumber: true })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} {...form.register("description")} />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminEventsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState<string>("any");
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const eventsQuery = useQuery({
    queryKey: ["events", "admin-list", { page, statusFilter }],
    queryFn: () =>
      fetchEvents({
        page,
        limit: 20,
        status: statusFilter !== "any" ? statusFilter : undefined,
      }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: EventStatus }) =>
      updateEventStatus(id, { status }),
    onSuccess: () => {
      toast.success("Event updated");
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, "Could not update event")),
  });

  const removeEvent = useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => {
      toast.success("Event deleted");
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setDeleteId(null);
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, "Could not delete event")),
  });

  const totalPages =
    eventsQuery.data?.pagination?.totalPages ??
    eventsQuery.data?.pagination?.pages ??
    1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Events</h1>
          <p className="text-sm text-muted-foreground">
            Confirm, dismiss, or manually log events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="false_positive">False positive</SelectItem>
            </SelectContent>
          </Select>
          <CreateEventDialog />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All events</CardTitle>
          <CardDescription>
            Bulk operations are not enabled; act per-event from the row menu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {eventsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (eventsQuery.data?.events ?? []).length === 0 ? (
            <EmptyState
              title="No events"
              description="No events match this status filter."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Detected</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Magnitude</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(eventsQuery.data?.events ?? []).map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <Link
                        href={`/events/${event.id}`}
                        className="text-primary underline"
                      >
                        {formatDateTime(event.detected_at)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {EVENT_TYPE_LABEL[event.event_type] ?? event.event_type}
                    </TableCell>
                    <TableCell>
                      {formatMagnitude(event.magnitude_estimate)}
                    </TableCell>
                    <TableCell>{formatConfidence(event.confidence)}</TableCell>
                    <TableCell className="text-xs">
                      {formatLatLng(event.latitude, event.longitude)}
                    </TableCell>
                    <TableCell>
                      <EventStatusBadge status={event.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={event.status === "confirmed"}
                            onClick={() =>
                              updateStatus.mutate({
                                id: event.id,
                                status: "confirmed",
                              })
                            }
                          >
                            Confirm
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={event.status === "false_positive"}
                            onClick={() =>
                              updateStatus.mutate({
                                id: event.id,
                                status: "false_positive",
                              })
                            }
                          >
                            Mark false positive
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={event.status === "pending"}
                            onClick={() =>
                              updateStatus.mutate({
                                id: event.id,
                                status: "pending",
                              })
                            }
                          >
                            Set pending
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(event.id)}
                          >
                            <Trash className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the event and all of its detection records. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && removeEvent.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
