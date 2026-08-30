import "server-only";

import { weekDates } from "@/lib/date";
import { buildScheduleMatrix, type ScheduleRow } from "@/lib/domain/schedule";
import { isRosterMember } from "@/lib/employee";
import { employeeRepository } from "@/server/repositories/employee.repository";
import { leaveRepository } from "@/server/repositories/leave.repository";
import { shiftRepository } from "@/server/repositories/shift.repository";
import type { Employee, IsoDate, LeaveRequest, Shift } from "@/types/domain";

export interface RosterWeek {
  weekStart: IsoDate;
  dates: IsoDate[];
  /** Every roster row: rostered people and task rows, never admins. */
  rows: ScheduleRow[];
  /** Real people only — the basis for headcount and payroll. */
  staffRows: ScheduleRow[];
  /**
   * The full active directory, admins included — a lookup table, not a roster.
   * `PendingActions` resolves request authors through it, and an admin can file
   * a leave request, so filtering this would render their row nameless.
   */
  employees: Employee[];
  shifts: Shift[];
  approvedLeave: LeaveRequest[];
}

/**
 * The one place a week of roster data is assembled. Summary, timetable and
 * team pages all read from this so they can never disagree about the numbers.
 */
export async function getRosterWeek(weekStart: IsoDate): Promise<RosterWeek> {
  const dates = weekDates(weekStart);

  const [employees, shifts, approvedLeave] = await Promise.all([
    employeeRepository.list(),
    shiftRepository.listByWeek(weekStart),
    leaveRepository.listApprovedOverlapping(dates[0], dates[6]),
  ]);

  // `isRosterMember` is applied here and nowhere else: `staffRows`, payroll,
  // headcount and every timetable view derive from `rows`, so one filter keeps
  // all of them agreeing about who is on the schedule.
  const rows = buildScheduleMatrix(
    employees.filter(isRosterMember),
    shifts,
    approvedLeave,
    dates,
  );
  const staffRows = rows.filter((row) => !row.employee.isTaskRow);

  return {
    weekStart,
    dates,
    rows,
    staffRows,
    employees,
    shifts,
    approvedLeave,
  };
}
