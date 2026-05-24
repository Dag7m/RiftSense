import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="container flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
      <ShieldAlert className="h-12 w-12 text-destructive" />
      <p className="text-sm font-medium text-muted-foreground">403</p>
      <h1 className="text-3xl font-bold tracking-tight">Access denied</h1>
      <p className="max-w-md text-muted-foreground">
        You do not have permission to view this page. If you believe this is a
        mistake, contact an administrator.
      </p>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
