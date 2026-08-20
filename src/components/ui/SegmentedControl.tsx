import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface SegmentOption {
  key: string;
  label: ReactNode;
  href: string;
  active: boolean;
}

export interface SegmentedControlProps {
  options: SegmentOption[];
  className?: string;
  ariaLabel: string;
}

/**
 * Navigation-driven tab strip: each segment is a link, so the choice lands in
 * the URL and the page stays a Server Component.
 *
 * `tone`, `bordered` and `variant` used to be declared here and were never read
 * by the implementation — three props callers could pass with no effect. They
 * are gone; no call site passed them.
 *
 * The track scrolls rather than squeezing, so adding a fourth view later cannot
 * crush the labels below a readable width.
 */
export function SegmentedControl({ options, className, ariaLabel }: SegmentedControlProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "flex overflow-x-auto rounded-md border border-line bg-surface",
        className,
      )}
    >
      {options.map((option) => (
        <Link
          key={option.key}
          href={option.href}
          aria-current={option.active ? "page" : undefined}
          className={cn(
            // 44px tall, and `min-w-0 flex-1` lets a long label truncate instead
            // of forcing the strip wider than its container.
            "flex min-h-11 min-w-24 flex-1 items-center justify-center rounded-md px-3",
            "text-base font-bold transition-colors",
            // The global focus ring is clipped by the track's own rounding, so
            // pull it inside.
            "focus-visible:outline-offset-[-3px]",
            option.active
              ? "bg-brand text-white hover:bg-brand-dark"
              : "text-muted hover:bg-hover hover:text-ink",
          )}
        >
          <span className="truncate">{option.label}</span>
        </Link>
      ))}
    </nav>
  );
}
