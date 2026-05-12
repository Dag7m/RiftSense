"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Database,
  LayoutDashboard,
  ListChecks,
  Radio,
  ScrollText,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/events", label: "Events", icon: Activity },
  { href: "/admin/nodes", label: "Nodes", icon: Radio },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/audit", label: "Audit logs", icon: ScrollText },
  { href: "/admin/database", label: "Database", icon: Database },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 border-r bg-background md:block">
      <div className="flex h-full flex-col gap-1 p-3">
        <p className="px-3 pb-2 text-xs font-semibold uppercase text-muted-foreground">
          Admin
        </p>
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                active && "bg-accent text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

export function AdminMobileNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b bg-background px-2 py-2 md:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent",
              active && "bg-accent text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
