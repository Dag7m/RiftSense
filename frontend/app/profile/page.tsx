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
  fetchMe,
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
    </div>
  );
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
