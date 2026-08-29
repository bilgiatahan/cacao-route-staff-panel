import { addIsoDays, currentWeekStartIso, weeksBetween } from "@/lib/date";
import { formatMonthLabel, formatWeekLabel } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import type { IsoDate } from "@/types/domain";

/**
 * One row of the week picker, formatted on the server.
 *
 * Everything here is a finished string: the picker is a Client Component and
 * the dictionary does not cross that boundary — same contract as the roster's
 * `view-model`.
 */
export interface WeekOption {
  href: string;
  /** The range itself, e.g. "3–9 Ağu". */
  label: string;
  /** Where it sits relative to now: "Bu Hafta", "2 hafta önce". */
  hint: string;
  /** "Ağu 2026", set only on the row that opens a new month. */
  monthHeading: string | null;
  /** The week currently on screen. */
  selected: boolean;
  /** The week containing today, which is not necessarily the selected one. */
  current: boolean;
}

/** The whole picker payload, built once per page render. */
export interface WeekPickerData {
  weeks: WeekOption[];
  /** The week containing today, reachable however far you have wandered. */
  todayHref: string;
  labels: {
    open: string;
    title: string;
    close: string;
    today: string;
  };
}

/**
 * How many weeks either side of the displayed one the picker offers.
 *
 * 6 keeps the list inside one thumb-reachable scroll on a phone while covering
 * the range people actually jump to. It is not a limit on travel: the list is
 * rebuilt around whatever week you land on, so a second open moves you another
 * six, and the "this week" shortcut is always one tap away.
 */
const WEEK_RADIUS = 6;

/**
 * "2 hafta önce" — measured from the week containing today, never from the week
 * on screen, so the hint means the same thing however you got here.
 */
function relativeHint(week: IsoDate, currentWeek: IsoDate, dict: Dictionary): string {
  const offset = weeksBetween(currentWeek, week);
  if (offset === 0) return dict.calendar.thisWeek;
  if (offset === -1) return dict.calendar.lastWeek;
  if (offset === 1) return dict.calendar.comingWeek;
  if (offset < 0) return `${-offset} ${dict.calendar.weeksAgo}`;
  return `${offset} ${dict.calendar.weeksAhead}`;
}

/**
 * The rows the week picker shows, centred on `weekStart`.
 *
 * `weekHref` comes from the page rather than from here because only the page
 * knows the rest of its URL — the roster carries a view and a day, the summary
 * carries nothing — and it is the same function the arrows already use, so a
 * jump and a step land on identically shaped URLs. That is also how the
 * "this week" shortcut is built: as an offset, not as a second href builder
 * that could drift from the first.
 */
export function buildWeekPicker(
  weekStart: IsoDate,
  weekHref: (offsetWeeks: number) => string,
  dict: Dictionary,
): WeekPickerData {
  const currentWeek = currentWeekStartIso();
  let previousHeading: string | null = null;

  const weeks = Array.from({ length: WEEK_RADIUS * 2 + 1 }, (_, index) => {
    const offset = index - WEEK_RADIUS;
    const start = addIsoDays(weekStart, offset * 7);
    const heading = formatMonthLabel(start, dict);
    // A heading is drawn only when the month changes, so August is named once
    // rather than beside all five of its weeks.
    const monthHeading = heading === previousHeading ? null : heading;
    previousHeading = heading;

    return {
      href: weekHref(offset),
      label: formatWeekLabel(start, dict),
      hint: relativeHint(start, currentWeek, dict),
      monthHeading,
      selected: offset === 0,
      current: start === currentWeek,
    };
  });

  return {
    weeks,
    todayHref: weekHref(weeksBetween(weekStart, currentWeek)),
    labels: {
      open: dict.calendar.pickWeek,
      title: dict.calendar.pickWeek,
      close: dict.common.close,
      today: dict.calendar.goToThisWeek,
    },
  };
}
