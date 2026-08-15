import "server-only";

import { todayIso, weekdayIndex } from "@/lib/date";
import { countGapDays } from "@/lib/domain/coverage";
import type { ScheduleCell, ScheduleRow } from "@/lib/domain/schedule";
import { calculateWeeklyPay } from "@/lib/domain/payroll";
import type { Period } from "@/lib/week-params";
import { leaveRepository } from "@/server/repositories/leave.repository";
import { swapRepository } from "@/server/repositories/swap.repository";
import type { Employee, IsoDate, LeaveRequest, Shift, SwapRequest } from "@/types/domain";

import { buildPayrollReport, weeksInPeriod, type PayrollReport } from "./payroll.service";
import { getRosterWeek, type RosterWeek } from "./roster.service";

export interface OnShiftToday {
  employee: Employee;
  shift: Shift;
}

export interface AdminSummary {
  kind: "admin";
  roster: RosterWeek;
  payroll: PayrollReport;
  period: Period;
  weeksInPeriod: number;
  headcount: number;
  gapDays: number;
  /** `null` when the visible week does not contain today. */
  today: IsoDate | null;
  onShiftToday: OnShiftToday[];
  pendingLeave: LeaveRequest[];
  pendingSwaps: SwapRequest[];
}

export interface StaffSummary {
  kind: "staff";
  roster: RosterWeek;
  period: Period;
  weeksInPeriod: number;
  employee: Employee;
  myRow: ScheduleRow | null;
  myHours: number;
  myPay: number;
  /** Next upcoming shift within the visible week. */
  nextShift: ScheduleCell | null;
  today: IsoDate | null;
  onShiftToday: OnShiftToday[];
  leaveBalance: number;
}

/** The visible week only contains "today" when the real date falls inside it. */
function resolveToday(roster: RosterWeek): IsoDate | null {
  const today = todayIso();
  return roster.dates.includes(today) ? today : null;
}

function collectOnShift(roster: RosterWeek, date: IsoDate | null): OnShiftToday[] {
  if (!date) return [];
  return roster.rows
    .flatMap((row) => {
      const cell = row.cells.find((item) => item.date === date);
      return cell?.shift ? [{ employee: row.employee, shift: cell.shift }] : [];
    })
    .sort((a, b) => a.shift.startMinutes - b.shift.startMinutes);
}

export async function getAdminSummary(
  weekStart: IsoDate,
  period: Period,
): Promise<AdminSummary> {
  const roster = await getRosterWeek(weekStart);
  const [pendingLeave, pendingSwaps] = await Promise.all([
    leaveRepository.listByStatus("pending"),
    swapRepository.listByStatus("pending"),
  ]);

  const today = resolveToday(roster);

  return {
    kind: "admin",
    roster,
    payroll: buildPayrollReport(roster, period),
    period,
    weeksInPeriod: weeksInPeriod(period, weekStart),
    headcount: roster.staffRows.length,
    gapDays: countGapDays(roster.coverage),
    today,
    onShiftToday: collectOnShift(roster, today),
    pendingLeave,
    pendingSwaps,
  };
}

export async function getStaffSummary(
  employeeId: string,
  weekStart: IsoDate,
  period: Period,
): Promise<StaffSummary | null> {
  const roster = await getRosterWeek(weekStart);
  const myRow = roster.staffRows.find((row) => row.employee.id === employeeId) ?? null;
  if (!myRow) return null;

  const weeks = weeksInPeriod(period, weekStart);
  const weeklyPay = calculateWeeklyPay(myRow.hours, myRow.employee.hourlyRate);
  const today = resolveToday(roster);

  // "Next up" means the first shift from today onwards; when the user is
  // browsing another week it simply means the first shift of that week.
  const fromIndex = today ? weekdayIndex(today) : 0;
  const nextShift =
    myRow.cells.slice(fromIndex).find((cell) => cell.shift) ??
    (today ? null : (myRow.cells.find((cell) => cell.shift) ?? null));

  return {
    kind: "staff",
    roster,
    period,
    weeksInPeriod: weeks,
    employee: myRow.employee,
    myRow,
    myHours: myRow.hours * weeks,
    myPay: weeklyPay.total * weeks,
    nextShift,
    today,
    onShiftToday: collectOnShift(roster, today),
    leaveBalance: myRow.employee.leaveBalance,
  };
}
