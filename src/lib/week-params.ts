import { currentWeekStartIso, isValidIsoDate, startOfWeekIso } from "@/lib/date";
import type { IsoDate } from "@/types/domain";

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

export function resolvePeriod(value: string | undefined): Period {
  return value === "month" ? "month" : "week";
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
