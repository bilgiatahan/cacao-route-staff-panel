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

export interface SegmentedControlProps {
  options: SegmentOption[];
  tone?: SegmentTone;
  /** Draws the hairline frame; the roster tab strip sits flush instead. */
  bordered?: boolean;
  /**
   * `flush` is the squared strip the ruled views use. `pill` is the soft track
   * with a raised active segment, for the card views.
   */
  variant?: "flush" | "pill";
  className?: string;
  ariaLabel: string;
}

/**
 * Navigation-driven segmented control: each segment is a link, so the choice
 * ends up in the URL and the page stays a server component.
 */
export function SegmentedControl({
  options,
  className,
  ariaLabel,
}: SegmentedControlProps) {

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "flex rounded-md border border-line bg-surface",
        className,
      )}
    >
      {options.map((option) => (
        <Link
          key={option.key}
          href={option.href}
          aria-current={option.active ? "page" : undefined}
          className={cn(
            "flex-1 text-center transition-colors rounded-md rounded-md px-2 py-2 text-md font-bold",
            option.active
              ?  "bg-brand text-white"
              :  "text-muted hover:text-ink bg-surface"
          )}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}
