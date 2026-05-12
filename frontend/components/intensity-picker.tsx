"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { intensityColor } from "@/lib/formatters";

const SHORT_LABELS: Record<number, string> = {
  1: "Not felt",
  2: "Weak",
  3: "Weak",
  4: "Light",
  5: "Moderate",
  6: "Strong",
  7: "Very strong",
  8: "Severe",
  9: "Violent",
  10: "Extreme",
};

interface IntensityPickerProps {
  value?: number;
  onChange: (v: number) => void;
}

export function IntensityPicker({ value, onChange }: IntensityPickerProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {Array.from({ length: 10 }).map((_, i) => {
          const level = i + 1;
          const active = level === value;
          return (
            <button
              key={level}
              type="button"
              onClick={() => onChange(level)}
              className={cn(
                "flex h-10 w-full items-center justify-center rounded-md border text-sm font-semibold transition",
                intensityColor(level),
                active
                  ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
                  : "opacity-80 hover:opacity-100",
              )}
              aria-pressed={active}
              aria-label={`Intensity ${level} — ${SHORT_LABELS[level] ?? ""}`}
            >
              {level}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {value
          ? `${value} — ${SHORT_LABELS[value] ?? ""} on the Modified Mercalli scale.`
          : "Pick the level that best describes what you felt (1 = not felt, 10 = extreme)."}
      </p>
    </div>
  );
}
