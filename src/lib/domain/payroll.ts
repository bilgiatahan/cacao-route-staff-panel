import type { Employee, Shift } from "@/types/domain";

/**
 * Pure payroll rules — no I/O, so both the server and the client can run them.
 */

export function shiftHours(shift: Shift): number {
  return (shift.endMinutes - shift.startMinutes) / 60;
}

export function sumHours(shifts: Shift[]): number {
  return shifts.reduce((total, shift) => total + shiftHours(shift), 0);
}

export interface PayBreakdown {
  /** Hours worked in the period. */
  hours: number;
  hourlyRate: number;
  total: number;
}

/** Weekly pay: every hour at the base rate. */
export function calculateWeeklyPay(hours: number, hourlyRate: number): PayBreakdown {
  return {
    hours,
    hourlyRate,
    total: hours * hourlyRate,
  };
}

export interface PayrollLine {
  employee: Employee;
  /** Hours in the selected period (week, or the monthly projection). */
  hours: number;
  hourlyRate: number;
  total: number;
}

export function buildPayrollLine(
  employee: Employee,
  weeklyShifts: Shift[],
  weeksInPeriod = 1,
): PayrollLine {
  const weeklyHours = sumHours(weeklyShifts);
  const weekly = calculateWeeklyPay(weeklyHours, employee.hourlyRate);

  return {
    employee,
    hours: weekly.hours * weeksInPeriod,
    hourlyRate: employee.hourlyRate,
    total: weekly.total * weeksInPeriod,
  };
}

export function sumPayroll(lines: PayrollLine[]): { hours: number; total: number } {
  return lines.reduce(
    (acc, line) => ({ hours: acc.hours + line.hours, total: acc.total + line.total }),
    { hours: 0, total: 0 },
  );
}
