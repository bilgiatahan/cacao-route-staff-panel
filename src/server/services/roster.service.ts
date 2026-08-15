import "server-only";

import { weekDates } from "@/lib/date";
import { analyseWeek, type DayCoverage } from "@/lib/domain/coverage";
import { buildScheduleMatrix, type ScheduleRow } from "@/lib/domain/schedule";
import { employeeRepository } from "@/server/repositories/employee.repository";
import { leaveRepository } from "@/server/repositories/leave.repository";
import { shiftRepository } from "@/server/repositories/shift.repository";
import type { Employee, IsoDate, LeaveRequest, Shift } from "@/types/domain";

export interface RosterWeek {
  weekStart: IsoDate;
  dates: IsoDate[];
  /** All roster rows, task rows included. */
  rows: ScheduleRow[];
  /** Real people only — the basis for headcount, payroll and coverage. */
  staffRows: ScheduleRow[];
  employees: Employee[];
  shifts: Shift[];
  approvedLeave: LeaveRequest[];
  coverage: DayCoverage[];
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

  const rows = buildScheduleMatrix(employees, shifts, approvedLeave, dates);
  const staffRows = rows.filter((row) => !row.employee.isTaskRow);
  const staffShifts = shifts.filter((shift) =>
    staffRows.some((row) => row.employee.id === shift.employeeId),
  );

  return {
    weekStart,
    dates,
    rows,
    staffRows,
    employees,
    shifts,
    approvedLeave,
    coverage: analyseWeek(dates, staffShifts),
  };
}
