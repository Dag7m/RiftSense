"use client";

import { AuthGuard } from "@/components/auth-guard";
import { AdminSidebar, AdminMobileNav } from "@/components/admin-sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard requireAdmin>
      <div className="container py-4">
        <div className="flex min-h-[calc(100vh-12rem)] gap-6">
          <AdminSidebar />
          <div className="flex-1 space-y-4">
            <AdminMobileNav />
            {children}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
