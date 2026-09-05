import "server-only";

import { cache } from "react";

import { employeeRepository } from "@/server/repositories/employee.repository";
import { leaveRepository } from "@/server/repositories/leave.repository";
import { shiftRepository } from "@/server/repositories/shift.repository";
import { swapRepository } from "@/server/repositories/swap.repository";
import type {
  Employee,
  IsoDate,
  LeaveRequest,
  SessionUser,
  Shift,
  SwapRequest,
} from "@/types/domain";

import { addIsoDays, todayIso } from "@/lib/date";
import { isRosterMember } from "@/lib/employee";

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
  /**
   * Staff only: every shift the viewer has yet to work, offered as swap
   * candidates. Not bounded by a week — the screen has no week to be on.
   */
  mySwapOptions: SwapOption[];
  /** Staff only: colleagues who can be asked to take a shift. */
  colleagues: Employee[];
  leaveBalance: number;
}

/**
 * Admins see the whole board; staff see only their own requests and the swaps
 * they are part of. The filtering lives here rather than in the page so the
 * rule is enforced in one place.
 *
 * Nothing here is scoped to a week: the swap options run from tomorrow to the
 * end of the written roster, and the histories are whole. The screen has no week
 * switcher because there is no week to switch.
 */
export async function getLeaveBoard(viewer: SessionUser): Promise<LeaveBoard> {
  const isAdmin = viewer.role === "admin";
  // Tomorrow onwards. A shift today has already started as far as the roster is
  // concerned, so it is not something to hand over.
  const swappableFrom = addIsoDays(todayIso(), 1);

  const [employees, allLeave, allSwaps, myShifts] = await Promise.all([
    employeeRepository.listStaff(),
    isAdmin ? leaveRepository.list() : leaveRepository.listByEmployee(viewer.employeeId),
    isAdmin ? swapRepository.list() : swapRepository.listForEmployee(viewer.employeeId),
    // An admin holds no roster row, so there is nothing of theirs to offer and
    // no reason to read it.
    isAdmin ? [] : shiftRepository.listByEmployeeFrom(viewer.employeeId, swappableFrom),
  ]);

  const byId = new Map(employees.map((employee) => [employee.id, employee]));

  const leaveRows: LeaveRow[] = allLeave.map((request) => ({
    request,
    employee: byId.get(request.employeeId) ?? null,
    actionable: isAdmin && request.status === "pending",
  }));

  // The shift each request is about, fetched by its own (person, date) pair.
  // These used to be looked up in one loaded week, which was already wrong for a
  // request from last month and would now be wrong for most of them.
  const swapShifts = await shiftRepository.listForEmployeeDates(
    allSwaps.map((request) => ({ employeeId: request.requesterId, date: request.date })),
  );
  const shiftKey = (employeeId: string, date: IsoDate) => `${employeeId}\u0000${date}`;
  const shiftByPair = new Map(
    swapShifts.map((shift) => [shiftKey(shift.employeeId, shift.date), shift]),
  );

  const swapRows: SwapRow[] = allSwaps.map((request) => ({
    request,
    requester: byId.get(request.requesterId) ?? null,
    target: byId.get(request.targetId) ?? null,
    shift: shiftByPair.get(shiftKey(request.requesterId, request.date)) ?? null,
    actionable: isAdmin && request.status === "pending",
  }));

  const mySwapOptions: SwapOption[] = myShifts.map((shift) => ({
    date: shift.date,
    shift,
  }));

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
    // The viewer's own stored balance. Only the staff view renders it; an admin
    // reading their own row here would be reading a number their screen has no
    // card for.
    leaveBalance: byId.get(viewer.employeeId)?.leaveBalance ?? 0,
  };
}
