import "server-only";

import { endOfMonthIso, previousIsoMonth, startOfMonthIso } from "@/lib/date";
import {
  buildMonthlyCostReport,
  compareWithPreviousMonth,
  type MonthlyCostReport,
} from "@/lib/domain/monthly-cost";
import { employeeRepository } from "@/server/repositories/employee.repository";
import { shiftRepository } from "@/server/repositories/shift.repository";
import type { IsoMonth } from "@/types/domain";

/**
 * Monthly personnel cost over actual shifts.
 *
 * Three queries, issued together, and nothing else:
 *
 *   - the active non-task roster, for names, positions and rates
 *   - every shift whose date falls inside the calendar month
 *   - the same for the previous month, which is the comparison baseline
 *
 * Coverage gaps and per-week headcount need no query of their own: both are
 * derived from the shifts already in hand, which is the reason `analyseWeek` is
 * reusable here at all. Pending leave and swaps are deliberately *not* read —
 * this service answers what the month cost, not what needs a decision.
 *
 * The month range is the only filter the database applies to shifts, which is
 * what keeps the month-boundary rule airtight: a week straddling July and August
 * can only ever contribute its August days, because its July days are never
 * fetched. `Shift.date` is a `YYYY-MM-DD` string where lexicographic order is
 * chronological order, and `@@index([date])` covers the range, so this is one
 * index scan over a few hundred rows.
 *
 * Deliberately not built on `getRosterWeek`: that assembles exactly seven days
 * plus approved leave plus coverage analysis, so a six-week month would cost
 * eighteen queries and compute leave shading and coverage gaps this report does
 * not use. Deliberately not built on `buildPayrollReport` / `weeksInPeriod`
 * either — those multiply one week by the Mondays in the month, which is a
 * forecast. This is the actuals, and the two must not be derived from each other.
 *
 * Roster eligibility (admins excluded via `isRosterMember`, task rows excluded
 * via `isTaskRow`) is applied inside `buildMonthlyCostReport` rather than here,
 * so there is one filter site rather than two that can drift apart. The whole
 * `listStaff()` result is handed over as-is.
 *
 * ## Known limitation
 *
 * **Historical reports currently use the employee's current hourly rate because
 * rate history is not stored.** A month is recomputed with today's rates, so a
 * pay rise silently restates past months. The seam for fixing this is the
 * optional fourth argument to `buildMonthlyCostReport`: pass a resolver that
 * reads an effective-dated rate and every figure below becomes historically
 * correct with no change to `MonthlyCostReport` or its consumers. See
 * `HourlyRateResolver` for why cost is accumulated per shift.
 */
export async function getMonthlyCostReport(month: IsoMonth): Promise<MonthlyCostReport> {
  const previous = previousIsoMonth(month);

  const [employees, shifts, previousShifts] = await Promise.all([
    employeeRepository.listStaff(),
    shiftRepository.listByDateRange(startOfMonthIso(month), endOfMonthIso(month)),
    shiftRepository.listByDateRange(startOfMonthIso(previous), endOfMonthIso(previous)),
  ]);

  return compareWithPreviousMonth(
    buildMonthlyCostReport(month, employees, shifts),
    buildMonthlyCostReport(previous, employees, previousShifts),
  );
}
