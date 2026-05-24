import * as React from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface StatTile {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  hint?: string;
}

interface StatTilesProps {
  tiles: StatTile[];
  loading?: boolean;
  className?: string;
}

export function StatTiles({ tiles, loading, className }: StatTilesProps) {
  if (loading) {
    return (
      <div
        className={cn(
          "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
          className,
        )}
      >
        {Array.from({ length: tiles.length || 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="mb-2 h-4 w-20" />
              <Skeleton className="h-7 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
        className,
      )}
    >
      {tiles.map((tile) => (
        <Card key={tile.label}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{tile.label}</span>
              {tile.icon}
            </div>
            <div className="mt-1 text-2xl font-semibold">{tile.value}</div>
            {tile.hint && (
              <div className="mt-1 text-xs text-muted-foreground">
                {tile.hint}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
