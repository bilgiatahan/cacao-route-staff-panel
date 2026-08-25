import {
  currentMonthIso,
  currentWeekStartIso,
  isValidIsoDate,
  isValidIsoMonth,
  monthOfIsoDate,
  startOfWeekIso,
} from "@/lib/date";
import type { IsoDate, IsoMonth } from "@/types/domain";

export type Period = "week" | "month";
export type RosterView = "grid" | "person" | "day";

/**
 * The week, view and day live in the URL rather than component state, so the
 * pages stay server-rendered, shareable and back-button friendly.
 */

export function resolveWeekStart(value: string | undefined): IsoDate {
  if (value && isValidIsoDate(value)) return startOfWeekIso(value);
  return currentWeekStartIso();
}

/**
 * `?month=` for the calendar-month report.
 *
 * Accepts `YYYY-MM`, or a full `YYYY-MM-DD` which is narrowed to its month —
 * the same "snap anything valid to the canonical form, otherwise fall back to
 * now" shape as `resolveWeekStart`, so a link that already carries a date can
 * point at a month without being rewritten.
 */
export function resolveMonth(value: string | undefined): IsoMonth {
  if (value) {
    if (isValidIsoMonth(value)) return value;
    if (isValidIsoDate(value)) return monthOfIsoDate(value);
  }
  return currentMonthIso();
}

export function resolveRosterView(value: string | undefined): RosterView {
  if (value === "person" || value === "day") return value;
  return "grid";
}

/** Clamps a `?day=` param to a weekday index, defaulting to today when in range. */
export function resolveDayIndex(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 6) return parsed;
  return fallback;
}
