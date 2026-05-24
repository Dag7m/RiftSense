"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { LogIn } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import { loginRequest } from "@/lib/queries";
import { LoginSchema, type LoginInput } from "@/lib/types";

export default function LoginPageRoute() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}

function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginInput) => {
    try {
      const result = await loginRequest(values);
      setTokens(result.tokens);
      setUser(result.user);
      toast.success("Welcome back");
      router.push(next.startsWith("/") ? next : "/");
    } catch (error) {
      toast.error(apiErrorMessage(error, "Login failed"));
    }
  };

  return (
    <div className="container flex flex-1 items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5" />
            Sign in
          </CardTitle>
          <CardDescription>
            Use your RiftSense account to submit felt reports or manage the
            network.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-sm text-muted-foreground">
              No account?{" "}
              <Link
                href={`/register${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
                className="text-primary underline"
              >
                Create one
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
