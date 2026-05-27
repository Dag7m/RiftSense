"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthGuard } from "@/components/auth-guard";
import { apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import {
  changePasswordRequest,
  fetchMyLocation,
  fetchMe,
  upsertMyLocation,
  updateMe,
} from "@/lib/queries";
import {
  ChangePasswordSchema,
  ProfileSchema,
  type ChangePasswordInput,
  type ProfileInput,
} from "@/lib/types";

function ProfileForms() {
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const locationQuery = useQuery({
    queryKey: ["location", "me"],
    queryFn: fetchMyLocation,
  });

  const profileForm = useForm<ProfileInput>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: { name: "", email: "" },
  });
  const { reset: resetProfile } = profileForm;

  React.useEffect(() => {
    if (!meQuery.data) return;
    resetProfile({
      name: meQuery.data.name ?? "",
      email: meQuery.data.email ?? "",
    });
  }, [meQuery.data, resetProfile]);

  const updateProfile = useMutation({
    mutationFn: updateMe,
    onSuccess: (user) => {
      setUser(user);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Profile updated");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Update failed")),
  });

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const changePassword = useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      changePasswordRequest({
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      }),
    onSuccess: () => {
      passwordForm.reset();
      toast.success("Password changed");
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, "Could not change password")),
  });

  const [loc, setLoc] = React.useState<{
    latitude: string;
    longitude: string;
    radius_km: string;
    notifications_enabled: boolean;
  }>({
    latitude: "",
    longitude: "",
    radius_km: "",
    notifications_enabled: true,
  });

  React.useEffect(() => {
    const l = locationQuery.data;
    if (!l) return;
    setLoc({
      latitude: l.latitude != null ? String(l.latitude) : "",
      longitude: l.longitude != null ? String(l.longitude) : "",
      radius_km: l.radius_km != null ? String(l.radius_km) : "",
      notifications_enabled: l.notifications_enabled !== false,
    });
  }, [locationQuery.data]);

  const saveLocation = useMutation({
    mutationFn: async () => {
      const lat = parseFloat(loc.latitude);
      const lon = parseFloat(loc.longitude);
      const radius =
        loc.radius_km.trim() === "" ? null : parseFloat(loc.radius_km);

      return await upsertMyLocation({
        latitude: lat,
        longitude: lon,
        radius_km: Number.isFinite(radius as number) ? radius : null,
        notifications_enabled: loc.notifications_enabled,
      });
    },
    onSuccess: async () => {
      toast.success("Location saved");
      await queryClient.invalidateQueries({ queryKey: ["location", "me"] });
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, "Could not save location")),
  });

  const enablePush = useMutation({
    mutationFn: async () => {
      if (typeof window === "undefined") throw new Error("Not in browser");
      if (!("serviceWorker" in navigator)) {
        throw new Error("Service workers are not supported in this browser");
      }
      if (!("PushManager" in window)) {
        throw new Error("Push is not supported in this browser");
      }

      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        throw new Error("Notification permission not granted");
      }

      const reg = await navigator.serviceWorker.register("/sw.js");

      // Get public key from backend (keeps one source of truth).
      const resp = await fetch("http://localhost:3000/api/push/vapid-public-key");
      const json = await resp.json();
      const publicKey = json?.data?.publicKey as string;
      if (!publicKey) throw new Error("Missing VAPID public key");

      const key = urlBase64ToUint8Array(publicKey);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });

      // Send subscription to backend (uses existing axios instance for auth headers)
      const { api } = await import("@/lib/api");
      await api.post("/api/push/subscribe", { subscription: sub });

      return true;
    },
    onSuccess: () => toast.success("Push notifications enabled"),
    onError: (e) => toast.error(apiErrorMessage(e, "Failed to enable push")),
  });

  if (meQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (meQuery.isError) {
    return (
      <p className="text-sm text-destructive">
        {apiErrorMessage(meQuery.error, "Could not load your profile")}
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your display info.</CardDescription>
        </CardHeader>
        <form
          onSubmit={profileForm.handleSubmit((values) =>
            updateProfile.mutate({
              name: values.name?.trim() || undefined,
              email: values.email?.trim() || undefined,
            }),
          )}
        >
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Name</Label>
              <Input id="profile-name" {...profileForm.register("name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                {...profileForm.register("email")}
              />
            </div>
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Saving…" : "Save changes"}
            </Button>
          </CardContent>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            Use a strong password you do not reuse elsewhere.
          </CardDescription>
        </CardHeader>
        <form
          onSubmit={passwordForm.handleSubmit((values) =>
            changePassword.mutate(values),
          )}
        >
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                {...passwordForm.register("currentPassword")}
              />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.currentPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register("newPassword")}
              />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register("confirmPassword")}
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? "Updating…" : "Update password"}
            </Button>
          </CardContent>
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Location & alerts</CardTitle>
          <CardDescription>
            Set your location to receive earthquake alerts when events occur
            within your nearby radius.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!navigator.geolocation) {
                  toast.error("Geolocation is not supported in this browser");
                  return;
                }
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    setLoc((s) => ({
                      ...s,
                      latitude: String(pos.coords.latitude),
                      longitude: String(pos.coords.longitude),
                    }));
                    toast.success("Location detected. Click Save location.");
                  },
                  () => {
                    toast.error(
                      "Could not get your location. Allow location permission and try again.",
                    );
                  },
                  { enableHighAccuracy: true, timeout: 10000 },
                );
              }}
            >
              Use my current location
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => enablePush.mutate()}
              disabled={enablePush.isPending}
            >
              {enablePush.isPending ? "Enabling…" : "Enable push notifications"}
            </Button>

            <Button
              type="button"
              onClick={() => saveLocation.mutate()}
              disabled={saveLocation.isPending}
            >
              {saveLocation.isPending ? "Saving…" : "Save location"}
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="loc-lat">Latitude</Label>
              <Input
                id="loc-lat"
                inputMode="decimal"
                value={loc.latitude}
                onChange={(e) =>
                  setLoc((s) => ({ ...s, latitude: e.target.value }))
                }
                placeholder="e.g. 9.035"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-lon">Longitude</Label>
              <Input
                id="loc-lon"
                inputMode="decimal"
                value={loc.longitude}
                onChange={(e) =>
                  setLoc((s) => ({ ...s, longitude: e.target.value }))
                }
                placeholder="e.g. 38.763"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-radius">Max radius (km)</Label>
              <Input
                id="loc-radius"
                inputMode="decimal"
                value={loc.radius_km}
                onChange={(e) =>
                  setLoc((s) => ({ ...s, radius_km: e.target.value }))
                }
                placeholder="optional (e.g. 20)"
              />
              <p className="text-xs text-muted-foreground">
                Optional cap. The system still uses magnitude-based radius, but
                will not notify you beyond this value.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Alerts</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="checkbox"
                  checked={loc.notifications_enabled}
                  onChange={(e) =>
                    setLoc((s) => ({
                      ...s,
                      notifications_enabled: e.target.checked,
                    }))
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm">Enable notifications</span>
              </div>
            </div>
          </div>

          {locationQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">
              Loading saved location…
            </p>
          ) : locationQuery.data ? (
            <p className="text-xs text-muted-foreground">
              Saved location last updated:{" "}
              {locationQuery.data.updated_at
                ? new Date(locationQuery.data.updated_at).toLocaleString()
                : "—"}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              No location saved yet. Add one to receive geo alerts.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <div className="container space-y-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Your account</h1>
          <p className="text-sm text-muted-foreground">
            Manage your RiftSense profile and password.
          </p>
        </div>
        <ProfileForms />
      </div>
    </AuthGuard>
  );
}
