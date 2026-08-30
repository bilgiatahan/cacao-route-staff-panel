import "server-only";

import { endOfMonthIso, monthOfIsoDate, startOfMonthIso } from "@/lib/date";
import { buildEmployeeMonth, type EmployeeMonth } from "@/lib/domain/employee-month";
import { calculateWeeklyPay, type PayBreakdown } from "@/lib/domain/payroll";
import type { ScheduleRow } from "@/lib/domain/schedule";
import { employeeRepository } from "@/server/repositories/employee.repository";
import { shiftRepository } from "@/server/repositories/shift.repository";
import { userRepository } from "@/server/repositories/user.repository";
import type { Employee, IsoDate, IsoMonth } from "@/types/domain";

import { getRosterWeek } from "./roster.service";

export interface TeamMemberSummary {
  employee: Employee;
  weeklyHours: number;
  weeklyPay: PayBreakdown;
}

export interface TeamOverview {
  weekStart: IsoDate;
  members: TeamMemberSummary[];
}

export interface EmployeeDetail {
  employee: Employee;
  row: ScheduleRow | null;
  weeklyHours: number;
  weeklyPay: PayBreakdown;
  /**
   * The selected calendar month over the shifts actually worked.
   *
   * This used to be `weeklyHours * mondaysInMonth` — a forecast of the displayed
   * week. It is now the actuals, because the screen lets you pick a month and a
   * forecast of *this* week projected onto *another* month means nothing.
   */
  month: EmployeeMonth;
  /** Whether this person can sign in. Never exposes the credentials themselves. */
  hasAccount: boolean;
}

export async function getTeamOverview(weekStart: IsoDate): Promise<TeamOverview> {
  const roster = await getRosterWeek(weekStart);

  const members = roster.staffRows.map<TeamMemberSummary>((row) => ({
    employee: row.employee,
    weeklyHours: row.hours,
    weeklyPay: calculateWeeklyPay(row.hours, row.employee.hourlyRate),
  }));

  return { weekStart, members };
}

/**
 * One person's week and month.
 *
 * The two periods are independent — the screen has a switcher for each — so they
 * are two separate reads rather than one derived from the other. `month`
 * defaults to the month the displayed week falls in, which is what a caller with
 * no month of its own (the staff pay card) wants.
 *
 * The month costs one extra query, narrowed to this employee: the whole-org
 * `getMonthlyCostReport` would answer the same question with three queries over
 * every shift in two months.
 */
export async function getEmployeeDetail(
  employeeId: string,
  weekStart: IsoDate,
  month: IsoMonth = monthOfIsoDate(weekStart),
): Promise<EmployeeDetail | null> {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) return null;

  const [roster, account, monthShifts] = await Promise.all([
    getRosterWeek(weekStart),
    userRepository.findByEmployeeId(employeeId),
    shiftRepository.listByEmployeeAndDateRange(
      employeeId,
      startOfMonthIso(month),
      endOfMonthIso(month),
    ),
  ]);

  const row = roster.rows.find((item) => item.employee.id === employeeId) ?? null;
  const weeklyHours = row?.hours ?? 0;

  return {
    employee,
    row,
    weeklyHours,
    weeklyPay: calculateWeeklyPay(weeklyHours, employee.hourlyRate),
    month: buildEmployeeMonth(month, employee.hourlyRate, monthShifts),
    hasAccount: account !== null,
  };
}
