import "server-only";

import { mondaysInMonth } from "@/lib/date";
import { calculateWeeklyPay, type PayBreakdown } from "@/lib/domain/payroll";
import type { ScheduleRow } from "@/lib/domain/schedule";
import { employeeRepository } from "@/server/repositories/employee.repository";
import { userRepository } from "@/server/repositories/user.repository";
import type { Employee, IsoDate } from "@/types/domain";

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
  monthlyHours: number;
  monthlyPay: number;
  weeksInMonth: number;
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

export async function getEmployeeDetail(
  employeeId: string,
  weekStart: IsoDate,
): Promise<EmployeeDetail | null> {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) return null;

  const [roster, account] = await Promise.all([
    getRosterWeek(weekStart),
    userRepository.findByEmployeeId(employeeId),
  ]);

  const row = roster.rows.find((item) => item.employee.id === employeeId) ?? null;
  const weeklyHours = row?.hours ?? 0;
  const weeklyPay = calculateWeeklyPay(weeklyHours, employee.hourlyRate);
  const weeksInMonth = mondaysInMonth(weekStart);

  return {
    employee,
    row,
    weeklyHours,
    weeklyPay,
    monthlyHours: weeklyHours * weeksInMonth,
    monthlyPay: weeklyPay.total * weeksInMonth,
    weeksInMonth,
    hasAccount: account !== null,
  };
}
