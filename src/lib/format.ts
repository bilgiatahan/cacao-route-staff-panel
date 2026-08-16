import { CURRENCY_SYMBOL } from "@/lib/constants";
import { fromIsoDate, weekDates } from "@/lib/date";
import type { Dictionary } from "@/lib/i18n";
import type { IsoDate, Shift } from "@/types/domain";

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

export function formatMoney(amount: number): string {
  return `${CURRENCY_SYMBOL}${Math.round(amount).toLocaleString("tr-TR")}`;
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

/** "Ağu 2026" for the month containing the middle of the week. */
export function formatMonthLabel(weekStart: IsoDate, dict: Dictionary): string {
  const middle = fromIsoDate(weekDates(weekStart)[3]);
  return `${dict.calendar.months[middle.getMonth()]} ${middle.getFullYear()}`;
}

/** "08:00–16:00", or the em dash when there is no shift. */
export function formatShiftSpan(shift: Shift | null | undefined, dict: Dictionary): string {
  if (!shift) return dict.common.dash;
  return `${minutesToTime(shift.startMinutes)}–${minutesToTime(shift.endMinutes)}`;
}

/** Compact "8–16" used inside the tiny person-view chips. */
export function formatShiftSpanCompact(shift: Shift | null | undefined): string {
  if (!shift) return "·";
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
