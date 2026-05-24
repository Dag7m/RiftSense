import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container space-y-4 py-8">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
