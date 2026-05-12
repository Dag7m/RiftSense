"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin } from "lucide-react";

import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { IntensityPicker } from "@/components/intensity-picker";
import { apiErrorMessage } from "@/lib/api";
import { fetchRecentEvents, submitFeltReport } from "@/lib/queries";
import { FeltReportSchema, type FeltReportInput } from "@/lib/types";

const MapPicker = dynamic(
  () => import("@/components/maps/map-picker").then((m) => m.MapPicker),
  { ssr: false, loading: () => <Skeleton className="h-[320px] w-full" /> },
);

function FeltItForm() {
  const router = useRouter();

  const form = useForm<FeltReportInput>({
    resolver: zodResolver(FeltReportSchema),
    defaultValues: {
      latitude: 0,
      longitude: 0,
      intensity: 4,
      description: "",
      event_id: "",
      is_anonymous: false,
    },
  });

  const lat = form.watch("latitude");
  const lon = form.watch("longitude");
  const intensity = form.watch("intensity");

  const eventsQuery = useQuery({
    queryKey: ["events", "recent", { hours: 24, limit: 50 }],
    queryFn: () => fetchRecentEvents(24, 50),
  });

  const mutation = useMutation({
    mutationFn: submitFeltReport,
    onSuccess: () => {
      toast.success("Thanks — your report has been recorded.");
      router.push("/reports");
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, "Could not submit report")),
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (lat || lon) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        form.setValue("latitude", parseFloat(pos.coords.latitude.toFixed(6)));
        form.setValue("longitude", parseFloat(pos.coords.longitude.toFixed(6)));
      },
      () => {},
      { maximumAge: 60_000, timeout: 5_000 },
    );
  }, [form, lat, lon]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit a felt report</CardTitle>
        <CardDescription>
          Help the community understand the impact by sharing what you felt.
        </CardDescription>
      </CardHeader>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Location</Label>
            <MapPicker
              latitude={Number.isFinite(lat) ? lat : undefined}
              longitude={Number.isFinite(lon) ? lon : undefined}
              onChange={(la, lo) => {
                form.setValue("latitude", parseFloat(la.toFixed(6)), {
                  shouldValidate: true,
                });
                form.setValue("longitude", parseFloat(lo.toFixed(6)), {
                  shouldValidate: true,
                });
              }}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lat">Latitude</Label>
                <Input
                  id="lat"
                  type="number"
                  step="any"
                  {...form.register("latitude", { valueAsNumber: true })}
                />
                {form.formState.errors.latitude && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.latitude.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lon">Longitude</Label>
                <Input
                  id="lon"
                  type="number"
                  step="any"
                  {...form.register("longitude", { valueAsNumber: true })}
                />
                {form.formState.errors.longitude && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.longitude.message}
                  </p>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (!navigator.geolocation) {
                  toast.error("Geolocation not available");
                  return;
                }
                navigator.geolocation.getCurrentPosition((pos) => {
                  form.setValue(
                    "latitude",
                    parseFloat(pos.coords.latitude.toFixed(6)),
                  );
                  form.setValue(
                    "longitude",
                    parseFloat(pos.coords.longitude.toFixed(6)),
                  );
                });
              }}
            >
              <MapPin className="h-4 w-4" />
              Use my location
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Shaking intensity (Modified Mercalli)</Label>
            <Controller
              control={form.control}
              name="intensity"
              render={({ field }) => (
                <IntensityPicker
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                />
              )}
            />
            {form.formState.errors.intensity && (
              <p className="text-xs text-destructive">
                {form.formState.errors.intensity.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              rows={4}
              placeholder="What did you feel? Did anything move or fall?"
              {...form.register("description")}
            />
          </div>

          <div className="space-y-2">
            <Label>Related event (optional)</Label>
            <Controller
              control={form.control}
              name="event_id"
              render={({ field }) => (
                <Select
                  value={field.value || "none"}
                  onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No event" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No related event</SelectItem>
                    {(eventsQuery.data ?? []).map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.event_type} · {new Date(e.detected_at).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="anon">Submit anonymously</Label>
              <p className="text-xs text-muted-foreground">
                Your name will not be shown publicly.
              </p>
            </div>
            <Controller
              control={form.control}
              name="is_anonymous"
              render={({ field }) => (
                <Switch
                  id="anon"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending || !intensity}
          >
            {mutation.isPending ? "Submitting…" : "Submit report"}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}

export default function FeltItPage() {
  return (
    <AuthGuard>
      <div className="container max-w-2xl space-y-4 py-8">
        <FeltItForm />
      </div>
    </AuthGuard>
  );
}
