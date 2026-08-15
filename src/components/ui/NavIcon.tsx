import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type NavIconName = "summary" | "timetable" | "leave" | "team" | "pay" | "notifications";

/**
 * The tab bar glyphs. Drawn by hand rather than pulled from an icon set so they
 * match the panel's language: straight lines, mitred joins, square caps — the
 * same geometry as the rules and badges around them.
 */
const PATHS: Record<NavIconName, ReactNode> = {
  // Bar chart — the summary tab's hours-at-a-glance.
  summary: (
    <>
      <path d="M4 20h16" />
      <path d="M7 20v-7" />
      <path d="M12 20V6" />
      <path d="M17 20v-10" />
    </>
  ),
  // Calendar grid — the weekly roster.
  timetable: (
    <>
      <path d="M4 5h16v15H4z" />
      <path d="M4 10h16" />
      <path d="M9 5V3" />
      <path d="M15 5V3" />
      <path d="M9.5 14h1" />
      <path d="M13.5 14h1" />
      <path d="M9.5 17h1" />
    </>
  ),
  // Door with an outbound arrow — off the roster.
  leave: (
    <>
      <path d="M13 4H5v16h8" />
      <path d="M14 12h6" />
      <path d="m17 8 4 4-4 4" />
    </>
  ),
  // Two figures — the team roster.
  team: (
    <>
      <path d="M6 7h4v4H6z" />
      <path d="M3 20v-3h10v3" />
      <path d="M15 8h3v3h-3z" />
      <path d="M16 20v-3h5v3" />
    </>
  ),
  // Banknote — what the staff tab shows instead of the team list.
  pay: (
    <>
      <path d="M3 6h18v12H3z" />
      <path d="M10 9h4v6h-4z" />
      <path d="M6 12h1" />
      <path d="M17 12h1" />
    </>
  ),
  // Bell, flattened into straight segments.
  notifications: (
    <>
      <path d="M6 17V10l6-4 6 4v7" />
      <path d="M4 17h16" />
      <path d="M10 20h4" />
    </>
  ),
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={cn("h-[18px] w-[18px]", className)}
    >
      {PATHS[name]}
    </svg>
  );
}
