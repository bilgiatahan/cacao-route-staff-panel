import "server-only";

import { cache } from "react";

import { employeeRepository } from "@/server/repositories/employee.repository";
import { leaveRepository } from "@/server/repositories/leave.repository";
import { swapRepository } from "@/server/repositories/swap.repository";
import type {
  Employee,
  IsoDate,
  LeaveRequest,
  SessionUser,
  Shift,
  SwapRequest,
} from "@/types/domain";

import { isRosterMember } from "@/lib/employee";

import { getRosterWeek } from "./roster.service";

export interface LeaveRow {
  request: LeaveRequest;
  employee: Employee | null;
  /** Only an admin can act, and only while the request is still pending. */
  actionable: boolean;
}

export interface SwapRow {
  request: SwapRequest;
  requester: Employee | null;
  target: Employee | null;
  /** The shift being handed over, when it still exists. */
  shift: Shift | null;
  actionable: boolean;
}

export interface SwapOption {
  date: IsoDate;
  shift: Shift;
}

export interface PendingRequests {
  leave: LeaveRequest[];
  swaps: SwapRequest[];
}

/**
 * Everything still awaiting a decision, read once per request.
 *
 * The panel layout needs the counts for its tab badge and the admin summary
 * needs the rows themselves; both used to query independently, so a single
 * admin render hit `listByStatus` twice per entity. `cache()` collapses that to
 * one pair — per request, so a decision taken in a Server Action is visible to
 * the render that follows it (the cache is scoped to the flight render, and the
 * action body runs outside one).
 */
export const getPendingRequests = cache(async (): Promise<PendingRequests> => {
  const [leave, swaps] = await Promise.all([
    leaveRepository.listByStatus("pending"),
    swapRepository.listByStatus("pending"),
  ]);
  return { leave, swaps };
});

export interface LeaveBoard {
  viewerRole: SessionUser["role"];
  leaveRows: LeaveRow[];
  swapRows: SwapRow[];
  pendingLeaveCount: number;
  /** Staff only: this week's own shifts, offered as swap candidates. */
  mySwapOptions: SwapOption[];
  /** Staff only: colleagues who can be asked to take a shift. */
  colleagues: Employee[];
  leaveBalance: number;
}

/**
 * Admins see the whole board; staff see only their own requests and the swaps
 * they are part of. The filtering lives here rather than in the page so the
 * rule is enforced in one place.
 */
export async function getLeaveBoard(
  viewer: SessionUser,
  weekStart: IsoDate,
): Promise<LeaveBoard> {
  const isAdmin = viewer.role === "admin";

  const [employees, allLeave, allSwaps, roster] = await Promise.all([
    employeeRepository.listStaff(),
    isAdmin ? leaveRepository.list() : leaveRepository.listByEmployee(viewer.employeeId),
    isAdmin ? swapRepository.list() : swapRepository.listForEmployee(viewer.employeeId),
    getRosterWeek(weekStart),
  ]);

  const byId = new Map(employees.map((employee) => [employee.id, employee]));

  const leaveRows: LeaveRow[] = allLeave.map((request) => ({
    request,
    employee: byId.get(request.employeeId) ?? null,
    actionable: isAdmin && request.status === "pending",
  }));

  const swapRows: SwapRow[] = allSwaps.map((request) => ({
    request,
    requester: byId.get(request.requesterId) ?? null,
    target: byId.get(request.targetId) ?? null,
    shift:
      roster.shifts.find(
        (shift) => shift.employeeId === request.requesterId && shift.date === request.date,
      ) ?? null,
    actionable: isAdmin && request.status === "pending",
  }));

  const myRow = roster.staffRows.find((row) => row.employee.id === viewer.employeeId);
  const mySwapOptions: SwapOption[] = (myRow?.cells ?? []).flatMap((cell) =>
    cell.shift ? [{ date: cell.date, shift: cell.shift }] : [],
  );

  const pendingLeaveCount = leaveRows.filter(
    (row) => row.request.status === "pending",
  ).length;

  return {
    viewerRole: viewer.role,
    leaveRows,
    swapRows,
    pendingLeaveCount,
    mySwapOptions,
    // Roster members only. An admin has no row on the timetable, so a shift
    // swapped onto them would disappear from the schedule entirely. `byId` above
    // stays unfiltered — it only resolves names on existing requests.
    colleagues: employees.filter(
      (employee) => employee.id !== viewer.employeeId && isRosterMember(employee),
    ),
    leaveBalance: myRow?.employee.leaveBalance ?? 0,
  };
}
