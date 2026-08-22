import {
  addIsoDays,
  countDaysInclusive,
  DAYS_IN_WEEK,
  endOfMonthIso,
  isDateInRange,
  startOfMonthIso,
  startOfWeekIso,
} from "@/lib/date";
import { analyseWeek, countGapDays } from "@/lib/domain/coverage";
import { calculateWeeklyPay, shiftHours } from "@/lib/domain/payroll";
import { employeeFullName, isRosterMember } from "@/lib/employee";
import type { Employee, IsoDate, IsoMonth, Localized, Shift } from "@/types/domain";

/**
 * Monthly personnel cost, from actual shifts — no projection, no overtime.
 *
 * This is the arithmetic half of the report: pure, no I/O, so every boundary
 * case (a week straddling two months, an empty month, a division by zero) is
 * unit-testable without a database.
 *
 * It is deliberately *not* `payroll.service.ts`. That one answers "what would a
 * month cost if this week repeated?" by multiplying one week by the Mondays in
 * the month. This one answers "what did the month actually cost?" by summing the
 * shifts that really happened. Both are wanted; they are different questions and
 * neither should be derived from the other.
 *
 * Nothing here formats: no currency, no locale, no dictionary. `position` stays
 * a `Localized` so the view layer makes the one localisation decision, in the
 * one place localisation decisions belong.
 */

/* ------------------------------------------------------------- hourly rate -- */

/**
 * How much an employee earned per hour on a given date.
 *
 * ## Known limitation
 *
 * **Historical reports currently use the employee's current hourly rate because
 * rate history is not stored.** The schema has a single mutable
 * `Employee.hourlyRate` column and no effective-dated rate table, so a report
 * for a past month is recomputed with whatever the rate is today. If someone's
 * rate changes, last month's figure changes with it.
 *
 * The `date` parameter is already threaded through and cost is accumulated one
 * shift at a time precisely so that this stays a swap rather than a rewrite:
 * supplying a resolver that reads an effective-dated rate makes historical
 * months correct without touching `MonthlyCostReport`, the service, or any
 * consumer. Aggregating hours first and multiplying once would have made the
 * same change impossible without breaking the public model.
 */
export type HourlyRateResolver = (employeeId: string, date: IsoDate) => number;

/**
 * The v1 resolver: each employee's currently stored rate, whatever the date.
 *
 * Returns 0 for an unknown id. That cannot happen through `buildMonthlyCostReport`,
 * which only ever asks about employees it was given, but a silent 0 is a better
 * failure than a `NaN` propagating into a money total.
 */
export function currentHourlyRateResolver(employees: Employee[]): HourlyRateResolver {
  const rates = new Map(employees.map((employee) => [employee.id, employee.hourlyRate]));
  return (employeeId) => rates.get(employeeId) ?? 0;
}

/* ------------------------------------------------------------------ model --- */

export interface CostTotals {
  hours: number;
  cost: number;
  /** `cost / hours`, or `null` when no hours were worked. Never `NaN`. */
  averageHourlyCost: number | null;
}

/** A change against a baseline. `absolute` always exists; `percent` may not. */
export interface Delta {
  absolute: number;
  /** `null` when the baseline is 0 — the change is undefined, not infinite. */
  percent: number | null;
}

/** One Monday–Sunday week, clipped to the month being reported on. */
export interface MonthWeekRange {
  /** The real Monday, even when it falls in the previous month. */
  weekStart: IsoDate;
  /** The real Sunday, even when it falls in the next month. */
  weekEnd: IsoDate;
  /** First day of the week that is inside the reported month. */
  rangeStart: IsoDate;
  /** Last day of the week that is inside the reported month. */
  rangeEnd: IsoDate;
  /** Days of this week inside the reported month, 1–7. */
  daysInMonth: number;
  isPartial: boolean;
}

export interface MonthlyWeekLine extends MonthWeekRange {
  /** Covers `rangeStart`–`rangeEnd` only; days outside the month contribute nothing. */
  totals: CostTotals;
  /** `null` for the first week — there is no previous week inside the month. */
  costChange: Delta | null;
  hoursChange: Delta | null;
  /**
   * In-month days of this week that opened late or closed early.
   *
   * Assessed over `rangeStart`–`rangeEnd` only, so a boundary week is never
   * marked short for days that belong to another month. Same rule as the
   * timetable's coverage strip — `analyseWeek` is reused rather than restated.
   */
  gapDays: number;
  /** Distinct cost-bearing people who worked inside the month this week. */
  activeStaffCount: number;
}

export interface MonthlyEmployeeLine {
  employeeId: string;
  name: string;
  /** Raw domain value; the view picks the locale. */
  position: Localized;
  /**
   * The rate applied to this employee this month.
   *
   * One stored rate today. Once rates are effective-dated and one changes
   * mid-month this becomes the rate in effect on `monthEnd`, with the blended
   * figure available as `cost / hours` — the field stays a single number either
   * way, so the model does not change shape.
   */
  hourlyRate: number;
  hours: number;
  cost: number;
  /** Percentage 0–100 of the month's cost, or `null` when the month cost 0. */
  shareOfCost: number | null;
}

/**
 * The month before, and how this one moved against it.
 *
 * Built by `compareWithPreviousMonth` from a second full report, so the previous
 * month is measured by exactly the same rules — same eligibility, same boundary
 * clipping, same rate resolver. Deriving it any other way is how two figures
 * that claim to be comparable stop being comparable.
 */
export interface PreviousMonthComparison {
  month: IsoMonth;
  totals: CostTotals;
  activeStaffCount: number;
  gapDays: number;

  costChange: Delta;
  hoursChange: Delta;
  /** `null` when either month had no hours — an undefined rate cannot move. */
  averageHourlyCostChange: Delta | null;
  activeStaffCountChange: Delta;
  gapDaysChange: Delta;
}

export interface MonthlyCostReport {
  month: IsoMonth;
  monthStart: IsoDate;
  monthEnd: IsoDate;

  totals: CostTotals;

  /**
   * Roster-eligible, non-task people with at least one shift in the month.
   *
   * Not the same number as `/summary`'s `headcount`, which is the size of the
   * current roster. Someone who was on the roster all month but never worked is
   * counted there and not here, which is correct for a report about money that
   * was actually spent.
   */
  activeStaffCount: number;

  /** In-month days that opened late or closed early — the sum of `weeks[].gapDays`. */
  gapDays: number;

  /** Monday–Sunday weeks touching the month, including any that are empty. */
  weeksInMonth: number;
  /** Weeks that contributed at least one shift — the average's denominator. */
  weeksWithData: number;
  averageWeeklyCost: number;
  averageWeeklyHours: number;
  /** Mean people per working week. Fractional on purpose — it is an average. */
  averageWeeklyStaffCount: number;

  weeks: MonthlyWeekLine[];
  /** Descending by cost; ties keep roster order. */
  employees: MonthlyEmployeeLine[];

  /** `null` until `compareWithPreviousMonth` attaches one. */
  previousMonth: PreviousMonthComparison | null;
}

/* ------------------------------------------------------------- primitives -- */

/**
 * Division that refuses to produce `Infinity` or `NaN`.
 *
 * Every ratio in this report has a legitimately empty case — a month with no
 * shifts, a week with no hours, an employee compared against a zero baseline —
 * and `null` says "undefined" where `0` would be read as a real measurement.
 */
function ratio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  const value = numerator / denominator;
  return Number.isFinite(value) ? value : null;
}

/** `part` as a percentage of `whole`, or `null` when `whole` is 0. */
function percentOf(part: number, whole: number): number | null {
  const share = ratio(part, whole);
  return share === null ? null : share * 100;
}

export function averageHourlyCost(cost: number, hours: number): number | null {
  return ratio(cost, hours);
}

export function delta(current: number, previous: number): Delta {
  return {
    absolute: current - previous,
    percent: percentOf(current - previous, previous),
  };
}

/**
 * A delta between two possibly-undefined figures.
 *
 * `null` on either side means the quantity did not exist that month, and a
 * change from "no value" is not a change of zero.
 */
export function deltaOrNull(current: number | null, previous: number | null): Delta | null {
  if (current === null || previous === null) return null;
  return delta(current, previous);
}

function totals(hours: number, cost: number): CostTotals {
  return { hours, cost, averageHourlyCost: averageHourlyCost(cost, hours) };
}

/**
 * Who counts towards personnel cost.
 *
 * The conjunction of two rules that already exist, not a third one:
 * `isRosterMember` (admins run the schedule rather than appear on it) and
 * `isTaskRow` ("Temizlik" is scheduled work, but not a wage).
 */
function isCostBearing(employee: Employee): boolean {
  return isRosterMember(employee) && !employee.isTaskRow;
}

/**
 * The Monday–Sunday weeks touching a month, each clipped to it.
 *
 * A week is always labelled by its real span, so `27 Jul – 2 Aug` reads as
 * itself in an August report while only 1–2 August contribute figures. Because
 * every week is keyed by its true Monday, no date can land in two buckets and
 * none can be missed.
 */
export function monthWeekRanges(monthStart: IsoDate, monthEnd: IsoDate): MonthWeekRange[] {
  const ranges: MonthWeekRange[] = [];

  // ISO dates compare lexicographically, which for `YYYY-MM-DD` is
  // chronologically — the same property the shift range query relies on.
  for (
    let weekStart = startOfWeekIso(monthStart);
    weekStart <= monthEnd;
    weekStart = addIsoDays(weekStart, DAYS_IN_WEEK)
  ) {
    const weekEnd = addIsoDays(weekStart, DAYS_IN_WEEK - 1);
    const rangeStart = weekStart < monthStart ? monthStart : weekStart;
    const rangeEnd = weekEnd > monthEnd ? monthEnd : weekEnd;
    const daysInMonth = countDaysInclusive(rangeStart, rangeEnd);

    ranges.push({
      weekStart,
      weekEnd,
      rangeStart,
      rangeEnd,
      daysInMonth,
      isPartial: daysInMonth < DAYS_IN_WEEK,
    });
  }

  return ranges;
}

/* --------------------------------------------------------------- builder --- */

/** Every ISO date from `start` to `end` inclusive. */
function datesInRange(start: IsoDate, end: IsoDate): IsoDate[] {
  return Array.from({ length: countDaysInclusive(start, end) }, (_, index) =>
    addIsoDays(start, index),
  );
}

interface Bucket {
  hours: number;
  cost: number;
  shifts: number;
  /** Ids, not a count: one person working five days is still one person. */
  people: Set<string>;
}

function emptyBucket(): Bucket {
  return { hours: 0, cost: 0, shifts: 0, people: new Set() };
}

function accumulate(
  into: Map<string, Bucket>,
  key: string,
  employeeId: string,
  hours: number,
  cost: number,
): void {
  const bucket = into.get(key) ?? emptyBucket();
  bucket.hours += hours;
  bucket.cost += cost;
  bucket.shifts += 1;
  bucket.people.add(employeeId);
  into.set(key, bucket);
}

/**
 * The month's actual hours and personnel cost, broken down by week and person.
 *
 * `employees` may be the whole active directory — eligibility is enforced here
 * and only here, so the service, the future page and these tests cannot disagree
 * about who is on the wage bill. `shifts` may be any set; anything outside the
 * month or belonging to an ineligible row is dropped rather than trusted.
 */
export function buildMonthlyCostReport(
  month: IsoMonth,
  employees: Employee[],
  shifts: Shift[],
  resolveHourlyRate: HourlyRateResolver = currentHourlyRateResolver(employees),
): MonthlyCostReport {
  const monthStart = startOfMonthIso(month);
  const monthEnd = endOfMonthIso(month);

  const costBearing = employees.filter(isCostBearing);
  const eligibleIds = new Set(costBearing.map((employee) => employee.id));

  const contributing = shifts.filter(
    (shift) =>
      eligibleIds.has(shift.employeeId) && isDateInRange(shift.date, monthStart, monthEnd),
  );

  const perWeek = new Map<IsoDate, Bucket>();
  const perEmployee = new Map<string, Bucket>();

  for (const shift of contributing) {
    const hours = shiftHours(shift);
    // `calculateWeeklyPay` is the project's single hours × rate rule, so it is
    // reused verbatim rather than re-implemented. It is applied per shift, not
    // per month, because that is what lets a date-aware rate resolver drop in
    // later without changing this function's output shape.
    const { total } = calculateWeeklyPay(
      hours,
      resolveHourlyRate(shift.employeeId, shift.date),
    );

    accumulate(perWeek, startOfWeekIso(shift.date), shift.employeeId, hours, total);
    accumulate(perEmployee, shift.employeeId, shift.employeeId, hours, total);
  }

  const ranges = monthWeekRanges(monthStart, monthEnd);

  // Month totals are summed from the week buckets rather than from the flat
  // shift list, so the weekly column a reader adds up agrees with the headline
  // exactly. The employee column is the same set of additions in a different
  // order, so it agrees to within floating-point precision.
  let monthHours = 0;
  let monthCost = 0;
  let monthGapDays = 0;
  let weeksWithData = 0;
  let staffWeekSum = 0;

  const weekBuckets = ranges.map((range) => {
    const bucket = perWeek.get(range.weekStart) ?? emptyBucket();
    monthHours += bucket.hours;
    monthCost += bucket.cost;

    // Coverage is judged only on the days this week contributes to the month,
    // so the 27 July week is not marked short for five days of July.
    const gapDays = countGapDays(
      analyseWeek(datesInRange(range.rangeStart, range.rangeEnd), contributing),
    );
    monthGapDays += gapDays;

    if (bucket.shifts > 0) {
      weeksWithData += 1;
      staffWeekSum += bucket.people.size;
    }

    return { totals: totals(bucket.hours, bucket.cost), gapDays, people: bucket.people.size };
  });

  const weeks = ranges.map<MonthlyWeekLine>((range, index) => {
    const current = weekBuckets[index];
    const previous = index === 0 ? null : weekBuckets[index - 1];

    return {
      ...range,
      totals: current.totals,
      costChange: previous === null ? null : delta(current.totals.cost, previous.totals.cost),
      hoursChange:
        previous === null ? null : delta(current.totals.hours, previous.totals.hours),
      gapDays: current.gapDays,
      activeStaffCount: current.people,
    };
  });

  const employeeLines = costBearing
    .flatMap<MonthlyEmployeeLine>((employee) => {
      const bucket = perEmployee.get(employee.id);
      if (!bucket) return [];

      return [
        {
          employeeId: employee.id,
          name: employeeFullName(employee),
          position: employee.position,
          hourlyRate: resolveHourlyRate(employee.id, monthEnd),
          hours: bucket.hours,
          cost: bucket.cost,
          shareOfCost: percentOf(bucket.cost, monthCost),
        },
      ];
    })
    // `sort` is stable, and `costBearing` arrives in roster order, so equal
    // costs keep the order the roster already puts them in.
    .sort((a, b) => b.cost - a.cost);

  return {
    month,
    monthStart,
    monthEnd,
    totals: totals(monthHours, monthCost),
    // Only employees with a bucket have a shift, so this is exactly
    // "eligible people who worked at least once this month".
    activeStaffCount: perEmployee.size,
    gapDays: monthGapDays,
    weeksInMonth: ranges.length,
    weeksWithData,
    // Partial boundary weeks count towards the average as they are, which keeps
    // `average × weeksWithData === total`. Using the weeks that actually carry
    // data — rather than every week touching the calendar — also keeps a
    // mid-month report honest: three elapsed weeks are not divided by six.
    averageWeeklyCost: ratio(monthCost, weeksWithData) ?? 0,
    averageWeeklyHours: ratio(monthHours, weeksWithData) ?? 0,
    averageWeeklyStaffCount: ratio(staffWeekSum, weeksWithData) ?? 0,
    weeks,
    employees: employeeLines,
    previousMonth: null,
  };
}

/**
 * Attaches a previous-month comparison to a report.
 *
 * Takes a whole second report rather than a handful of numbers, because the
 * point of the comparison is that both sides were measured identically — same
 * eligibility rules, same boundary clipping, same rate resolver. Building the
 * baseline any other way is how two figures that look comparable quietly stop
 * being so. The extra work is a second pass over a few hundred in-memory rows.
 *
 * Pure and non-mutating: the inputs are untouched and a new report comes back.
 */
export function compareWithPreviousMonth(
  current: MonthlyCostReport,
  previous: MonthlyCostReport,
): MonthlyCostReport {
  return {
    ...current,
    previousMonth: {
      month: previous.month,
      totals: previous.totals,
      activeStaffCount: previous.activeStaffCount,
      gapDays: previous.gapDays,

      costChange: delta(current.totals.cost, previous.totals.cost),
      hoursChange: delta(current.totals.hours, previous.totals.hours),
      averageHourlyCostChange: deltaOrNull(
        current.totals.averageHourlyCost,
        previous.totals.averageHourlyCost,
      ),
      activeStaffCountChange: delta(current.activeStaffCount, previous.activeStaffCount),
      gapDaysChange: delta(current.gapDays, previous.gapDays),
    },
  };
}
