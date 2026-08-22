import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/constants";
import { fromIsoDate, startOfMonthIso, weekDates } from "@/lib/date";
import type { Dictionary } from "@/lib/i18n";
import type { IsoDate, IsoMonth, Shift } from "@/types/domain";

/** 480 → "08:00" */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${`${hours}`.padStart(2, "0")}:${`${mins}`.padStart(2, "0")}`;
}

/** "08:30" → 510. Returns `null` for anything unparseable. */
export function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 23 || mins > 59) return null;
  return hours * 60 + mins;
}

/** Rounds to one decimal and drops a trailing `.0`. */
export function formatHoursValue(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

/** 38.5 → "38.5sa" / "38.5h" */
export function formatHours(hours: number, dict: Dictionary): string {
  return `${formatHoursValue(hours)}${dict.units.hourSuffix}`;
}

/**
 * 1040 → "£1,040.00".
 *
 * Always two decimals: pence are a meaningful part of a GBP payroll figure, so
 * the value is shown in full rather than rounded to whole pounds. The number
 * itself is untouched — this only decides how it reads.
 */
export function formatMoney(amount: number): string {
  return `${CURRENCY_SYMBOL}${amount.toLocaleString(MONEY_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * 13 → "£13.00/h".
 *
 * The symbol leads the amount in en-GB, which a bare `"13 £/h"` cannot express,
 * so the unit is a suffix in the dictionary and the currency comes from
 * `formatMoney`.
 */
export function formatHourlyRate(hourlyRate: number, dict: Dictionary): string {
  return `${formatMoney(hourlyRate)}${dict.units.perHour}`;
}

/** "2026-08-03" → "3 Ağu" */
export function formatDayMonth(iso: IsoDate, dict: Dictionary): string {
  const date = fromIsoDate(iso);
  return `${date.getDate()} ${dict.calendar.months[date.getMonth()]}`;
}

/** "2026-08-03" → "3 Ağu 2026" */
export function formatFullDate(iso: IsoDate, dict: Dictionary): string {
  return `${formatDayMonth(iso, dict)} ${fromIsoDate(iso).getFullYear()}`;
}

/** Collapses a single-day range to one date. */
export function formatDateRange(start: IsoDate, end: IsoDate, dict: Dictionary): string {
  if (start === end) return formatDayMonth(start, dict);
  return `${formatDayMonth(start, dict)} – ${formatDayMonth(end, dict)}`;
}

/** "3–9 Ağu" for the week beginning at `weekStart`. */
export function formatWeekLabel(weekStart: IsoDate, dict: Dictionary): string {
  const dates = weekDates(weekStart);
  const first = fromIsoDate(dates[0]);
  const last = fromIsoDate(dates[6]);
  const monthLabel = dict.calendar.months[last.getMonth()];
  return `${first.getDate()}–${last.getDate()} ${monthLabel}`;
}

/**
 * "10–16 Ağu" for a week inside one month, "27 Tem – 2 Ağu" for one that crosses.
 *
 * `formatWeekLabel` above cannot answer this: it labels a whole week from its
 * Monday and always names the *last* day's month, which for 27 July – 2 August
 * reads "27–2 Ağu" — a range that appears to run backwards inside August. The
 * monthly report lists exactly those boundary weeks, so it needs the honest form.
 */
export function formatWeekSpan(start: IsoDate, end: IsoDate, dict: Dictionary): string {
  const from = fromIsoDate(start);
  const to = fromIsoDate(end);

  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    return `${from.getDate()}–${to.getDate()} ${dict.calendar.months[to.getMonth()]}`;
  }
  return formatDateRange(start, end, dict);
}

/** "Ağu 2026" for the month containing the middle of the week. */
export function formatMonthLabel(weekStart: IsoDate, dict: Dictionary): string {
  const middle = fromIsoDate(weekDates(weekStart)[3]);
  return `${dict.calendar.months[middle.getMonth()]} ${middle.getFullYear()}`;
}

/**
 * "Ağu 2026" for a calendar month.
 *
 * Distinct from `formatMonthLabel`, which takes a *week start* and reports the
 * month its midpoint falls in. That is the right answer for a week-scoped screen
 * and the wrong one for a month-scoped report, which already knows its month.
 */
export function formatMonthName(month: IsoMonth, dict: Dictionary): string {
  const date = fromIsoDate(startOfMonthIso(month));
  return `${dict.calendar.months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * "+12.4%" / "-5.7%", or the em dash when there is no percentage to show.
 *
 * A `null` percent means the baseline was zero, so the change is undefined
 * rather than infinite — the dash says that, where "0%" or "∞" would both lie.
 */
export function formatSignedPercent(
  percent: number | null,
  dict: Dictionary,
): string {
  if (percent === null) return dict.common.dash;
  const rounded = Math.round(percent * 10) / 10;
  // -0 renders as "-0.0%", which reads as a fall that did not happen.
  const value = rounded === 0 ? 0 : rounded;
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/** "+£343.75" / "-£1,534.25" — a money difference, sign always shown. */
export function formatSignedMoney(amount: number): string {
  const value = amount === 0 ? 0 : amount;
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${formatMoney(Math.abs(value))}`;
}

/** "+34sa" / "-10sa" — an hours difference, sign always shown. */
export function formatSignedHours(hours: number, dict: Dictionary): string {
  const value = hours === 0 ? 0 : hours;
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${formatHours(Math.abs(value), dict)}`;
}

/** "9" for a whole average, "8.5" otherwise — a headcount mean. */
export function formatCount(value: number): string {
  return formatHoursValue(value);
}

/** "08:00–16:00", or the em dash when there is no shift. */
export function formatShiftSpan(shift: Shift | null | undefined, dict: Dictionary): string {
  if (!shift) return dict.common.dash;
  return `${minutesToTime(shift.startMinutes)}–${minutesToTime(shift.endMinutes)}`;
}

/** Compact "8–16" used inside the tiny person-view chips. */
export function formatShiftSpanCompact(shift: Shift | null | undefined): string {
  if (!shift) return "–";
  return `${formatHoursValue(shift.startMinutes / 60)}–${formatHoursValue(shift.endMinutes / 60)}`;
}

export function initials(firstName: string, lastName = ""): string {
  const first = firstName.trim().slice(0, 1);
  const second = lastName.trim().slice(0, 1) || firstName.trim().slice(1, 2);
  return `${first}${second}`.toUpperCase();
}

export function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/** "2 sa" / "1 gün" — coarse, which is all the notification list needs. */
export function formatRelativeTime(isoDateTime: string, dict: Dictionary): string {
  const elapsed = Date.now() - new Date(isoDateTime).getTime();
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return dict.notifications.justNow;
  if (minutes < 60) return `${minutes} ${dict.notifications.minutesAgo}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${dict.notifications.hoursAgo}`;
  return `${Math.floor(hours / 24)} ${dict.notifications.daysAgo}`;
}
