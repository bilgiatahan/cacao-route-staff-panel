import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "brand" | "warn";

const VALUE_TONES: Record<StatTone, string> = {
  neutral: "text-ink",
  brand: "text-brand",
  warn: "text-warn-dark",
};

export interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatTone;
  /** Highlights the whole tile — used when a number needs attention. */
  highlight?: boolean;
  className?: string;
}

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  highlight = false,
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        "px-4 py-3.5",
        highlight ? "bg-warn-soft" : "bg-surface",
        className,
      )}
    >
      <div className="label-eyebrow">{label}</div>
      <div className={cn("tabular mt-1.5 text-5xl font-extrabold -tracking-[0.03em]", VALUE_TONES[tone])}>
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

/** Compact variant used inside the employee card grid. */
export function MiniStatTile({ label, value, tone = "neutral", className }: StatTileProps) {
  return (
    <div className={cn("px-4 py-3.5", className)}>
      <div className="label-eyebrow">{label}</div>
      <div className={cn("tabular mt-1 text-3xl font-extrabold -tracking-[0.02em]", VALUE_TONES[tone])}>
        {value}
      </div>
    </div>
  );
}
