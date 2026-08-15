import "server-only";

import type { IsoDate, LeaveRequest, LeaveType, RequestStatus } from "@/types/domain";
import type { LeaveRequestModel as LeaveRequestRow } from "@/generated/prisma/models";

import { createId, prisma } from "../db/client";

export interface LeaveDraft {
  employeeId: string;
  type: LeaveType;
  startDate: IsoDate;
  endDate: IsoDate;
  note: string;
}

const NEWEST_FIRST = { createdAt: "desc" } as const;

function toLeaveRequest(row: LeaveRequestRow): LeaveRequest {
  return {
    id: row.id,
    employeeId: row.employeeId,
    type: row.type,
    startDate: row.startDate,
    endDate: row.endDate,
    note: row.note,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decidedByEmployeeId: row.decidedByEmployeeId,
  };
}

export const leaveRepository = {
  async list(): Promise<LeaveRequest[]> {
    const rows = await prisma.leaveRequest.findMany({ orderBy: NEWEST_FIRST });
    return rows.map(toLeaveRequest);
  },

  async listByEmployee(employeeId: string): Promise<LeaveRequest[]> {
    const rows = await prisma.leaveRequest.findMany({
      where: { employeeId },
      orderBy: NEWEST_FIRST,
    });
    return rows.map(toLeaveRequest);
  },

  async listByStatus(status: RequestStatus): Promise<LeaveRequest[]> {
    const rows = await prisma.leaveRequest.findMany({ where: { status }, orderBy: NEWEST_FIRST });
    return rows.map(toLeaveRequest);
  },

  /** Approved leave overlapping the given range — drives the roster shading. */
  async listApprovedOverlapping(start: IsoDate, end: IsoDate): Promise<LeaveRequest[]> {
    const rows = await prisma.leaveRequest.findMany({
      where: { status: "approved", startDate: { lte: end }, endDate: { gte: start } },
    });
    return rows.map(toLeaveRequest);
  },

  async findById(id: string): Promise<LeaveRequest | null> {
    const row = await prisma.leaveRequest.findUnique({ where: { id } });
    return row ? toLeaveRequest(row) : null;
  },

  async create(draft: LeaveDraft): Promise<LeaveRequest> {
    const row = await prisma.leaveRequest.create({
      data: {
        ...draft,
        id: createId("leave"),
        status: "pending",
        createdAt: new Date(),
        decidedAt: null,
        decidedByEmployeeId: null,
      },
    });
    return toLeaveRequest(row);
  },

  async decide(
    id: string,
    status: Exclude<RequestStatus, "pending">,
    decidedByEmployeeId: string,
  ): Promise<LeaveRequest | null> {
    // The `status: "pending"` guard lives in the WHERE clause so two admins
    // deciding at once cannot both win — the loser's update matches no rows and
    // it gets `null`, exactly as when the request does not exist.
    const { count } = await prisma.leaveRequest.updateMany({
      where: { id, status: "pending" },
      data: { status, decidedAt: new Date(), decidedByEmployeeId },
    });
    if (count === 0) return null;

    return this.findById(id);
  },
};
