import {
  addIsoDays,
  addIsoMonths,
  currentMonthIso,
  currentWeekStartIso,
  fromIsoDate,
  monthsBetween,
  startOfMonthIso,
  weeksBetween,
} from "@/lib/date";
import { formatMonthLabel, formatWeekLabel } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import type { IsoDate, IsoMonth } from "@/types/domain";

/**
 * One row of the period picker, formatted on the server.
 *
 * Everything here is a finished string: the picker is a Client Component and
 * the dictionary does not cross that boundary — same contract as the roster's
 * `view-model`.
 */
export interface PeriodOption {
  href: string;
  /** The period itself: "3–9 Ağu" for a week, "Ağu" for a month. */
  label: string;
  /** Where it sits relative to now: "Bu Hafta", "2 ay önce". */
  hint: string;
  /** The group this row opens — a month for weeks, a year for months. */
  groupHeading: string | null;
  /** The period currently on screen. */
  selected: boolean;
  /** The period containing today, which is not necessarily the selected one. */
  current: boolean;
}

/** The whole picker payload, built once per page render. */
export interface PeriodPickerData {
  options: PeriodOption[];
  /** The period containing today, reachable however far you have wandered. */
  todayHref: string;
  labels: {
    open: string;
    title: string;
    close: string;
    today: string;
  };
}

/**
 * How many periods either side of the displayed one a picker offers.
 *
 * 6 keeps the list inside one thumb-reachable scroll on a phone while covering
 * the range people actually jump to. It is not a limit on travel: the list is
 * rebuilt around whatever period you land on, so a second open moves you another
 * six, and the "today" shortcut is always one tap away.
 */
const RADIUS = 6;

/** The five ways a period can sit relative to now. */
interface RelativeWords {
  now: string;
  last: string;
  next: string;
  ago: string;
  ahead: string;
}

/**
 * "2 hafta önce" — measured from the period containing today, never from the one
 * on screen, so the hint means the same thing however you got here.
 */
function relativeHint(offset: number, words: RelativeWords): string {
  if (offset === 0) return words.now;
  if (offset === -1) return words.last;
  if (offset === 1) return words.next;
  return offset < 0 ? `${-offset} ${words.ago}` : `${offset} ${words.ahead}`;
}

/**
 * Drops a heading that repeats the one above it, so August is named once rather
 * than beside all five of its weeks.
 */
function dedupeHeadings(headings: string[]): (string | null)[] {
  let previous: string | null = null;
  return headings.map((heading) => {
    const shown = heading === previous ? null : heading;
    previous = heading;
    return shown;
  });
}

/**
 * The rows a picker shows, centred on the displayed period.
 *
 * `href` comes from the page rather than from here because only the page knows
 * the rest of its URL — the roster carries a view and a day, the employee detail
 * screen carries the *other* period — and it is the same function the arrows
 * already use, so a jump and a step land on identically shaped URLs. That is
 * also how the "today" shortcut is built: as an offset, not as a second href
 * builder that could drift from the first.
 */
function buildPicker(
  href: (offset: number) => string,
  offsetToToday: number,
  rows: { label: string; heading: string }[],
  labels: PeriodPickerData["labels"],
  words: RelativeWords,
): PeriodPickerData {
  const headings = dedupeHeadings(rows.map((row) => row.heading));

  return {
    options: rows.map((row, index) => {
      const offset = index - RADIUS;
      return {
        href: href(offset),
        label: row.label,
        hint: relativeHint(offset - offsetToToday, words),
        groupHeading: headings[index],
        selected: offset === 0,
        current: offset === offsetToToday,
      };
    }),
    todayHref: href(offsetToToday),
    labels,
  };
}

/** Weeks, labelled by their range and grouped by the month they mostly fall in. */
export function buildWeekPicker(
  weekStart: IsoDate,
  weekHref: (offsetWeeks: number) => string,
  dict: Dictionary,
): PeriodPickerData {
  const rows = Array.from({ length: RADIUS * 2 + 1 }, (_, index) => {
    const start = addIsoDays(weekStart, (index - RADIUS) * 7);
    return {
      label: formatWeekLabel(start, dict),
      heading: formatMonthLabel(start, dict),
    };
  });

  return buildPicker(
    weekHref,
    weeksBetween(weekStart, currentWeekStartIso()),
    rows,
    {
      open: dict.calendar.pickWeek,
      title: dict.calendar.pickWeek,
      close: dict.common.close,
      today: dict.calendar.goToThisWeek,
    },
    {
      now: dict.calendar.thisWeek,
      last: dict.calendar.lastWeek,
      next: dict.calendar.comingWeek,
      ago: dict.calendar.weeksAgo,
      ahead: dict.calendar.weeksAhead,
    },
  );
}

/** Months, labelled by name and grouped by year. */
export function buildMonthPicker(
  month: IsoMonth,
  monthHref: (offsetMonths: number) => string,
  dict: Dictionary,
): PeriodPickerData {
  const rows = Array.from({ length: RADIUS * 2 + 1 }, (_, index) => {
    const date = fromIsoDate(startOfMonthIso(addIsoMonths(month, index - RADIUS)));
    return {
      label: dict.calendar.months[date.getMonth()],
      heading: `${date.getFullYear()}`,
    };
  });

  return buildPicker(
    monthHref,
    monthsBetween(month, currentMonthIso()),
    rows,
    {
      open: dict.calendar.pickMonth,
      title: dict.calendar.pickMonth,
      close: dict.common.close,
      today: dict.calendar.goToThisMonth,
    },
    {
      now: dict.calendar.thisMonth,
      last: dict.calendar.lastMonth,
      next: dict.calendar.comingMonth,
      ago: dict.calendar.monthsAgo,
      ahead: dict.calendar.monthsAhead,
    },
  );
}
