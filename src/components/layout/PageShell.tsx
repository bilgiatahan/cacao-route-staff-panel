import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PageWidth = "narrow" | "wide" | "medium" | "data" | "board";

/**
 * The reading measure for one screen's content.
 *
 * The shell frame widens on desktop, but width is a per-screen decision: a form
 * or a profile wants a narrow column no matter how big the monitor is, while the
 * roster grid and the payroll table are the reason the extra room exists. Every
 * screen is `narrow` today, which is exactly what the app already looked like;
 * a screen opts into `wide` when it is migrated.
 *
 * The last three keys are the desktop measures. They are *additive*: below `lg`
 * every one of them emits exactly what the screen emits today — `max-w-panel`
 * for the three that are `narrow` now, and the untouched `wide` string for
 * `board`, which only the roster holds. So a screen can adopt one of them
 * without moving a pixel under 1024px, which is the whole point.
 */
const WIDTHS: Record<PageWidth, string> = {
  narrow: "max-w-panel",
  // From `md`, not `lg`: the grid needs 96px + 7 columns, which fits inside a
  // 768px viewport but not inside the 560px panel — so between those two the
  // roster used to scroll with the space to avoid it sitting unused.
  wide: "max-w-panel md:max-w-shell",
  /** 560 → 720. Forms and reading columns: Profile, new employee, notifications. */
  medium: "max-w-panel lg:max-w-form",
  /** 560 → 1216. Data-heavy screens that compose into columns on a desk. */
  data: "max-w-panel lg:max-w-full",
  /** `wide` below `lg`, then the whole workspace. The roster, and only it. */
  board: "max-w-panel md:max-w-shell lg:max-w-none",
};

export interface PageShellProps {
  children: ReactNode;
  width?: PageWidth;
  className?: string;
}

export function PageShell({ children, width = "narrow", className }: PageShellProps) {
  return (
    <div className={cn("mx-auto flex w-full flex-1 flex-col", WIDTHS[width], className)}>
      {children}
    </div>
  );
}
