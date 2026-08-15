import type { Employee, IsoDate, LeaveRequest, Shift } from "@/types/domain";

/** Groups shifts by employee id for O(1) lookups while building a matrix. */
export function indexShiftsByEmployee(shifts: Shift[]): Map<string, Map<IsoDate, Shift>> {
  const index = new Map<string, Map<IsoDate, Shift>>();
  for (const shift of shifts) {
    let byDate = index.get(shift.employeeId);
    if (!byDate) {
      byDate = new Map();
      index.set(shift.employeeId, byDate);
    }
    byDate.set(shift.date, shift);
  }
  return index;
}

export function isOnLeave(
  approvedLeave: LeaveRequest[],
  employeeId: string,
  date: IsoDate,
): boolean {
  return approvedLeave.some(
    (leave) =>
      leave.employeeId === employeeId && leave.startDate <= date && leave.endDate >= date,
  );
}

export type CellState = "shift" | "leave" | "off";

export interface ScheduleCell {
  date: IsoDate;
  shift: Shift | null;
  state: CellState;
}

export interface ScheduleRow {
  employee: Employee;
  cells: ScheduleCell[];
  /** Total scheduled hours for the week. */
  hours: number;
}

/**
 * Builds the employee × day matrix that the roster views render.
 * The leave state is derived from approved leave requests, so shading the grid
 * and approving a request can never drift apart.
 */
export function buildScheduleMatrix(
  employees: Employee[],
  shifts: Shift[],
  approvedLeave: LeaveRequest[],
  dates: IsoDate[],
): ScheduleRow[] {
  const index = indexShiftsByEmployee(shifts);

  return employees.map((employee) => {
    const byDate = index.get(employee.id);
    let hours = 0;

    const cells = dates.map<ScheduleCell>((date) => {
      const shift = byDate?.get(date) ?? null;
      if (shift) hours += (shift.endMinutes - shift.startMinutes) / 60;

      const state: CellState = shift
        ? "shift"
        : isOnLeave(approvedLeave, employee.id, date)
          ? "leave"
          : "off";

      return { date, shift, state };
    });

    return { employee, cells, hours };
  });
}
