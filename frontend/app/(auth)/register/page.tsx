"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

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
import { registerRequest } from "@/lib/queries";
import { RegisterSchema, type RegisterInput } from "@/lib/types";

export default function RegisterPageRoute() {
  return (
    <Suspense fallback={null}>
      <RegisterPage />
    </Suspense>
  );
}

function RegisterPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { email: "", password: "", name: "" },
  });

  const onSubmit = async (values: RegisterInput) => {
    try {
      const result = await registerRequest({
        email: values.email,
        password: values.password,
        name: values.name?.trim() || undefined,
      });
      setTokens(result.tokens);
      setUser(result.user);
      toast.success("Account created");
      router.push(next.startsWith("/") ? next : "/");
    } catch (error) {
      toast.error(apiErrorMessage(error, "Registration failed"));
    }
  };

  return (
    <div className="container flex flex-1 items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create an account
          </CardTitle>
          <CardDescription>
            Sign up to submit felt-it reports and follow event activity.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" autoComplete="name" {...register("name")} />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
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
                autoComplete="new-password"
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
              {isSubmitting ? "Creating account…" : "Create account"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
                className="text-primary underline"
              >
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
