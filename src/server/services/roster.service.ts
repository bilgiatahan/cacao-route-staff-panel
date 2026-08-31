import "server-only";

import { addIsoDays, DAYS_IN_WEEK, weekDates } from "@/lib/date";
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

export interface PreviousWeekPreview {
  /** The Monday the copy would read from. */
  sourceWeekStart: IsoDate;
  /** Roster shifts last week — what a copy would write. Zero means nothing to copy. */
  sourceCount: number;
  /** Roster shifts this week — what a copy would overwrite. */
  targetCount: number;
}

/**
 * What "copy last week" would actually do to the week already loaded.
 *
 * Both numbers are counted over the *roster* rather than over the raw shift
 * table, because `copyWeek` writes and deletes over the roster too — counting an
 * archived person's leftover row here would promise a copy that never touches
 * it. `week.rows` is already `isRosterMember`-filtered, so the set comes free.
 *
 * Takes the loaded week instead of a date: the page has just read this week's
 * shifts and employees, so the only thing left to fetch is last week's shifts.
 */
export async function getPreviousWeekPreview(
  week: RosterWeek,
): Promise<PreviousWeekPreview> {
  const sourceWeekStart = addIsoDays(week.weekStart, -DAYS_IN_WEEK);
  const roster = new Set(week.rows.map((row) => row.employee.id));

  const sourceShifts = await shiftRepository.listByWeek(sourceWeekStart);

  return {
    sourceWeekStart,
    sourceCount: sourceShifts.filter((shift) => roster.has(shift.employeeId)).length,
    targetCount: week.shifts.filter((shift) => roster.has(shift.employeeId)).length,
  };
}
