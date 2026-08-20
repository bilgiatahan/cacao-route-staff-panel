import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

/**
 * Semantic tones, each an ink on its own wash at 4.5:1 or better, so the label
 * is never carried by colour alone.
 */
const TONES: Record<BadgeTone, string> = {
  neutral: "bg-fill-strong text-muted",
  info: "bg-brand-soft text-brand-dark",
  success: "bg-success-soft text-success",
  warning: "bg-warn-soft text-warn-dark",
  danger: "bg-danger-soft text-danger",
};

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

/** Small status label. `rounded-sm` — a chip, deliberately not a pill. */
export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex flex-none items-center rounded-sm px-2 py-0.5",
        "text-2xs font-extrabold uppercase tracking-[0.08em]",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export interface CountBadgeProps {
  count: number;
  /** Completes the sentence, e.g. "3 unread" — a bare number says nothing. */
  label: string;
  tone?: BadgeTone;
  className?: string;
}

/**
 * The unread/pending counter. The header bell and the leave tab both had their
 * own copy of this markup, down to a `right-[calc(50%-21px)]` magic offset.
 *
 * Renders nothing at zero, caps at "99+" so a runaway number cannot stretch the
 * chip past its slot, and carries the count as words for assistive tech — the
 * digit alone is not a label.
 */
export function CountBadge({ count, label, tone = "warning", className }: CountBadgeProps) {
  if (count < 1) return null;

  return (
    <span
      className={cn(
        "tabular inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1",
        "text-nano font-extrabold",
        TONES[tone],
        className,
      )}
    >
      <span aria-hidden>{count > 99 ? "99+" : count}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
