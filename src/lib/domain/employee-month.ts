import { endOfMonthIso, startOfMonthIso } from "@/lib/date";
import { monthWeekRanges, type MonthWeekRange } from "@/lib/domain/monthly-cost";
import { shiftHours } from "@/lib/domain/payroll";
import type { IsoDate, IsoMonth, Shift } from "@/types/domain";

/**
 * One person's calendar month, over the shifts they actually worked.
 *
 * The distinction this module exists to hold: `buildPayrollLine`'s
 * `weeksInPeriod` multiplies a single week by the Mondays in the month, which is
 * a **forecast** — "if every week looked like this one". This is the
 * **actuals**. The employee detail screen used to show the forecast under the
 * heading "This Month", which is fine while you are looking at the current week
 * and a lie the moment you can pick a different month.
 *
 * The week segmentation is `monthWeekRanges`, the same function the monthly cost
 * report uses, so a week that straddles two months is split at the boundary here
 * exactly as it is there and the two screens cannot disagree about which days
 * belong to August.
 *
 * ## Known limitation
 *
 * Like `/reports`, a past month is priced with the employee's *current* hourly
 * rate, because rate history is not stored. A pay rise silently restates every
 * month before it. The seam is the same one: give this function a rate resolver
 * instead of a number once rates are effective-dated.
 */

export interface EmployeeMonthWeek extends MonthWeekRange {
  /** Hours worked on `rangeStart`–`rangeEnd`; days outside the month count 0. */
  hours: number;
  pay: number;
}

export interface EmployeeMonth {
  month: IsoMonth;
  monthStart: IsoDate;
  monthEnd: IsoDate;
  hourlyRate: number;
  hours: number;
  pay: number;
  /** Every week touching the month, including the ones with no shifts. */
  weeks: EmployeeMonthWeek[];
  /** Weeks that carried at least one shift — the month's working shape. */
  weeksWorked: number;
}

/**
 * `shifts` is expected to be this employee's shifts inside `month`; anything
 * outside the month is ignored rather than trusted, so a caller that widens its
 * query cannot silently inflate the total.
 */
export function buildEmployeeMonth(
  month: IsoMonth,
  hourlyRate: number,
  shifts: Shift[],
): EmployeeMonth {
  const monthStart = startOfMonthIso(month);
  const monthEnd = endOfMonthIso(month);

  const weeks = monthWeekRanges(monthStart, monthEnd).map<EmployeeMonthWeek>((range) => {
    const hours = shifts
      .filter((shift) => shift.date >= range.rangeStart && shift.date <= range.rangeEnd)
      .reduce((total, shift) => total + shiftHours(shift), 0);

    return { ...range, hours, pay: hours * hourlyRate };
  });

  // Summed from the weeks rather than from `shifts` directly: the two can only
  // agree if the total is derived from the same buckets the table renders.
  const hours = weeks.reduce((total, week) => total + week.hours, 0);

  return {
    month,
    monthStart,
    monthEnd,
    hourlyRate,
    hours,
    pay: hours * hourlyRate,
    weeks,
    weeksWorked: weeks.filter((week) => week.hours > 0).length,
  };
}
