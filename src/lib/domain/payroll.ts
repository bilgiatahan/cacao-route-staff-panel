import { OVERTIME_MULTIPLIER, OVERTIME_THRESHOLD_HOURS } from "@/lib/constants";
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
  /** Portion paid at the base rate. */
  baseHours: number;
  /** Portion paid at the overtime multiplier. */
  overtimeHours: number;
  hourlyRate: number;
  total: number;
}

/**
 * Weekly pay: everything up to the threshold at the base rate, the remainder
 * at the overtime multiplier.
 */
export function calculateWeeklyPay(hours: number, hourlyRate: number): PayBreakdown {
  const baseHours = Math.min(hours, OVERTIME_THRESHOLD_HOURS);
  const overtimeHours = Math.max(0, hours - OVERTIME_THRESHOLD_HOURS);

  return {
    hours,
    baseHours,
    overtimeHours,
    hourlyRate,
    total: baseHours * hourlyRate + overtimeHours * hourlyRate * OVERTIME_MULTIPLIER,
  };
}

export function isOvertime(hours: number): boolean {
  return hours > OVERTIME_THRESHOLD_HOURS;
}

export interface PayrollLine {
  employee: Employee;
  /** Hours in the selected period (week, or the monthly projection). */
  hours: number;
  overtimeHours: number;
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
    overtimeHours: weekly.overtimeHours * weeksInPeriod,
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
