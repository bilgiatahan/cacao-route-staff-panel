import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PageWidth = "narrow" | "wide";

/**
 * The reading measure for one screen's content.
 *
 * The shell frame widens on desktop, but width is a per-screen decision: a form
 * or a profile wants a narrow column no matter how big the monitor is, while the
 * roster grid and the payroll table are the reason the extra room exists. Every
 * screen is `narrow` today, which is exactly what the app already looked like;
 * a screen opts into `wide` when it is migrated.
 */
const WIDTHS: Record<PageWidth, string> = {
  narrow: "max-w-panel",
  // From `md`, not `lg`: the grid needs 96px + 7 columns, which fits inside a
  // 768px viewport but not inside the 560px panel — so between those two the
  // roster used to scroll with the space to avoid it sitting unused.
  wide: "max-w-panel md:max-w-shell",
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
