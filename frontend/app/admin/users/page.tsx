"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal, UserX } from "lucide-react";

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
import { Button } from "@/components/ui/button";
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
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import { apiErrorMessage } from "@/lib/api";
import {
  deactivateAdminUser,
  fetchAdminUsers,
  updateAdminUser,
} from "@/lib/queries";
import { formatDateTime } from "@/lib/formatters";
import { useAuthStore } from "@/lib/auth";

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [page, setPage] = React.useState(1);
  const [deactivateId, setDeactivateId] = React.useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin", "users", { page }],
    queryFn: () => fetchAdminUsers({ page, limit: 20 }),
  });

  const updateUser = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { role?: "user" | "admin"; is_active?: boolean };
    }) => updateAdminUser(id, input),
    onSuccess: () => {
      toast.success("User updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, "Could not update user")),
  });

  const deactivateUser = useMutation({
    mutationFn: (id: string) => deactivateAdminUser(id),
    onSuccess: () => {
      toast.success("User deactivated");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setDeactivateId(null);
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, "Could not deactivate user")),
  });

  const totalPages =
    usersQuery.data?.pagination?.totalPages ??
    usersQuery.data?.pagination?.pages ??
    1;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">
          Promote users to admin, demote, or deactivate accounts.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registered users</CardTitle>
          <CardDescription>
            Promoting a user grants admin privileges across the network.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (usersQuery.data?.users ?? []).length === 0 ? (
            <EmptyState
              title="No users"
              description="Once people register, they will appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(usersQuery.data?.users ?? []).map((user) => {
                  const isSelf = user.id === me?.id;
                  return (
                    <TableRow key={user.id}>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.name ?? "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={user.role === "admin" ? "default" : "secondary"}
                        >
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.is_active ? "success" : "secondary"}
                        >
                          {user.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(user.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isSelf}
                              aria-label="User actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {user.role === "admin" ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  updateUser.mutate({
                                    id: user.id,
                                    input: { role: "user" },
                                  })
                                }
                              >
                                Demote to user
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() =>
                                  updateUser.mutate({
                                    id: user.id,
                                    input: { role: "admin" },
                                  })
                                }
                              >
                                Promote to admin
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() =>
                                updateUser.mutate({
                                  id: user.id,
                                  input: { is_active: !user.is_active },
                                })
                              }
                            >
                              {user.is_active ? "Deactivate" : "Reactivate"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeactivateId(user.id)}
                            >
                              <UserX className="h-4 w-4" />
                              Permanently deactivate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
        open={!!deactivateId}
        onOpenChange={(open) => !open && setDeactivateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this user?</AlertDialogTitle>
            <AlertDialogDescription>
              The user will no longer be able to sign in. You can revert this by
              reactivating them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deactivateId && deactivateUser.mutate(deactivateId)
              }
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
