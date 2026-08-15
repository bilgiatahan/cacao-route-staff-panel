import "server-only";

import { mondaysInMonth } from "@/lib/date";
import { buildPayrollLine, sumPayroll, type PayrollLine } from "@/lib/domain/payroll";
import type { Period } from "@/lib/week-params";
import type { IsoDate } from "@/types/domain";

import { getRosterWeek, type RosterWeek } from "./roster.service";

export interface PayrollReport {
  period: Period;
  /** 1 for a week, or the number of Mondays in the month for a projection. */
  weeksInPeriod: number;
  lines: PayrollLine[];
  totalHours: number;
  totalCost: number;
}

export function weeksInPeriod(period: Period, weekStart: IsoDate): number {
  return period === "month" ? mondaysInMonth(weekStart) : 1;
}

/** Payroll for everyone on the roster except task rows. */
export function buildPayrollReport(roster: RosterWeek, period: Period): PayrollReport {
  const weeks = weeksInPeriod(period, roster.weekStart);

  const lines = roster.staffRows.map((row) => {
    const shifts = row.cells.flatMap((cell) => (cell.shift ? [cell.shift] : []));
    return buildPayrollLine(row.employee, shifts, weeks);
  });

  const totals = sumPayroll(lines);

  return {
    period,
    weeksInPeriod: weeks,
    lines,
    totalHours: totals.hours,
    totalCost: totals.total,
  };
}

export async function getPayrollReport(
  weekStart: IsoDate,
  period: Period,
): Promise<PayrollReport> {
  const roster = await getRosterWeek(weekStart);
  return buildPayrollReport(roster, period);
}

export function findPayrollLine(
  report: PayrollReport,
  employeeId: string,
): PayrollLine | undefined {
  return report.lines.find((line) => line.employee.id === employeeId);
}
