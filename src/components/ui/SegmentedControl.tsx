import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface SegmentOption {
  key: string;
  label: ReactNode;
  href: string;
  active: boolean;
}

export type SegmentTone = "ink" | "brand";

const ACTIVE_TONES: Record<SegmentTone, string> = {
  ink: "bg-ink text-white",
  brand: "bg-brand text-white",
};

export interface SegmentedControlProps {
  options: SegmentOption[];
  tone?: SegmentTone;
  /** Draws the hairline frame; the roster tab strip sits flush instead. */
  bordered?: boolean;
  className?: string;
  ariaLabel: string;
}

/**
 * Navigation-driven segmented control: each segment is a link, so the choice
 * ends up in the URL and the page stays a server component.
 */
export function SegmentedControl({
  options,
  tone = "ink",
  bordered = true,
  className,
  ariaLabel,
}: SegmentedControlProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn("flex", bordered && "border border-line-strong", className)}
    >
      {options.map((option) => (
        <Link
          key={option.key}
          href={option.href}
          aria-current={option.active ? "page" : undefined}
          className={cn(
            "flex-1 px-1.5 py-2.5 text-center text-xs font-bold uppercase tracking-[0.08em] transition-colors",
            "border-r border-line last:border-r-0",
            option.active ? ACTIVE_TONES[tone] : "bg-surface text-ink hover:bg-hover",
          )}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}
