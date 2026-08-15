import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type IconName =
  | "summary"
  | "timetable"
  | "leave"
  | "team"
  | "pay"
  | "notifications"
  | "menu"
  | "chevronRight"
  | "user"
  | "briefcase"
  | "settings"
  | "support"
  | "shield"
  | "globe"
  | "signOut"
  | "clock"
  | "calendarCheck"
  | "calendarClock"
  | "inbox"
  | "wallet"
  | "hourglass";

/**
 * Every glyph in the panel. Drawn by hand rather than pulled from an icon set
 * so they match the visual language: straight lines, mitred joins, square caps
 * — the same geometry as the rules and badges around them.
 */
const PATHS: Record<IconName, ReactNode> = {
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
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  chevronRight: <path d="m9 5 7 7-7 7" />,
  // Single figure — the signed-in person.
  user: (
    <>
      <path d="M8.5 4h7v6h-7z" />
      <path d="M4 20v-2.5c0-1.4 1.1-2.5 2.5-2.5h11c1.4 0 2.5 1.1 2.5 2.5V20" />
    </>
  ),
  briefcase: (
    <>
      <path d="M3 8h18v12H3z" />
      <path d="M9 8V5h6v3" />
      <path d="M3 13h18" />
    </>
  ),
  // Sliders rather than a gear: a cog reads as mush at 18px in this stroke.
  settings: (
    <>
      <path d="M4 8h10" />
      <path d="M18 8h2" />
      <path d="M14 6v4" />
      <path d="M4 16h4" />
      <path d="M12 16h8" />
      <path d="M8 14v4" />
    </>
  ),
  // Headset — help & support.
  support: (
    <>
      <path d="M5 14v-3l7-5 7 5v3" />
      <path d="M3 13h3v6H3z" />
      <path d="M18 13h3v6h-3z" />
      <path d="M18 19v2h-6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 20 6v6l-8 9-8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c4 4.5 4 12.5 0 17-4-4.5-4-12.5 0-17z" />
    </>
  ),
  signOut: (
    <>
      <path d="M11 4H4v16h7" />
      <path d="M13 12h8" />
      <path d="m18 8 4 4-4 4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.5l3.5 2" />
    </>
  ),
  // Leave balance: the calendar you get to tick off.
  calendarCheck: (
    <>
      <path d="M4 5h16v15H4z" />
      <path d="M4 10h16" />
      <path d="M9 5V3" />
      <path d="M15 5V3" />
      <path d="m8.5 14.5 2.5 2.5 4.5-4.5" />
    </>
  ),
  // Next shift: a date with a time on it.
  calendarClock: (
    <>
      <path d="M4 5h11v6" />
      <path d="M4 5v15h7" />
      <path d="M4 10h11" />
      <path d="M8 5V3" />
      <path d="M13 5V3" />
      <circle cx="17" cy="16" r="4.5" />
      <path d="M17 14v2l1.5 1" />
    </>
  ),
  inbox: (
    <>
      <path d="M3 5h18v14H3z" />
      <path d="M3 13h5l1 3h6l1-3h5" />
    </>
  ),
  // Wallet — money earned, as opposed to `pay`'s banknote (the rate itself).
  wallet: (
    <>
      <path d="M3 7h18v13H3z" />
      <path d="M3 7V4h13v3" />
      <path d="M15 12h6v4h-6z" />
    </>
  ),
  // Hourglass — days of leave still left to spend.
  hourglass: (
    <>
      <path d="M6 3h12" />
      <path d="M6 21h12" />
      <path d="M7 3v4l5 5 5-5V3" />
      <path d="M7 21v-4l5-5 5 5v4" />
    </>
  ),
};

export interface IconProps {
  name: IconName;
  className?: string;
}

export function Icon({ name, className }: IconProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={cn("h-[18px] w-[18px] flex-none", className)}
    >
      {PATHS[name]}
    </svg>
  );
}
