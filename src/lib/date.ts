import type { IsoDate } from "@/types/domain";

/**
 * Date helpers built on ISO `YYYY-MM-DD` strings.
 *
 * Every `Date` produced here is at local midnight, so day arithmetic never
 * slips across a timezone boundary the way `new Date("2026-08-03")` (UTC) can.
 */

export const DAYS_IN_WEEK = 7;

export function toIsoDate(date: Date): IsoDate {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parses `YYYY-MM-DD` into a local-midnight Date. */
export function fromIsoDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function isValidIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = fromIsoDate(value);
  return !Number.isNaN(date.getTime()) && toIsoDate(date) === value;
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function addIsoDays(iso: IsoDate, amount: number): IsoDate {
  return toIsoDate(addDays(fromIsoDate(iso), amount));
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const day = date.getDay(); // 0 = Sunday
  const offset = day === 0 ? -6 : 1 - day;
  const monday = addDays(date, offset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function startOfWeekIso(iso: IsoDate): IsoDate {
  return toIsoDate(startOfWeek(fromIsoDate(iso)));
}

export function todayIso(): IsoDate {
  return toIsoDate(new Date());
}

export function currentWeekStartIso(): IsoDate {
  return toIsoDate(startOfWeek(new Date()));
}

/** The seven ISO dates of the week beginning at `weekStart` (a Monday). */
export function weekDates(weekStart: IsoDate): IsoDate[] {
  const monday = fromIsoDate(weekStart);
  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => toIsoDate(addDays(monday, index)));
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(iso: IsoDate): number {
  const day = fromIsoDate(iso).getDay();
  return day === 0 ? 6 : day - 1;
}

export function isDateInRange(iso: IsoDate, start: IsoDate, end: IsoDate): boolean {
  return iso >= start && iso <= end;
}

/** Inclusive day count between two ISO dates. */
export function countDaysInclusive(start: IsoDate, end: IsoDate): number {
  const ms = fromIsoDate(end).getTime() - fromIsoDate(start).getTime();
  return Math.floor(ms / 86_400_000) + 1;
}

/**
 * How many Mondays fall in the month containing `iso`.
 * Used to project a weekly roster onto a month.
 */
export function mondaysInMonth(iso: IsoDate): number {
  const date = fromIsoDate(iso);
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    if (new Date(year, month, day).getDay() === 1) count += 1;
  }
  return count;
}

export function ageOn(birthDate: IsoDate, reference: Date = new Date()): number {
  const birth = fromIsoDate(birthDate);
  let age = reference.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    reference.getMonth() < birth.getMonth() ||
    (reference.getMonth() === birth.getMonth() && reference.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Whole months elapsed since `hiredAt`. */
export function tenureMonths(hiredAt: IsoDate, reference: Date = new Date()): number {
  const hired = fromIsoDate(hiredAt);
  let months =
    (reference.getFullYear() - hired.getFullYear()) * 12 + (reference.getMonth() - hired.getMonth());
  if (reference.getDate() < hired.getDate()) months -= 1;
  return Math.max(0, months);
}
