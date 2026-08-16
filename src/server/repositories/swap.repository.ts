import "server-only";

import type { IsoDate, RequestStatus, SwapRequest } from "@/types/domain";
import type { SwapRequestModel as SwapRequestRow } from "@/generated/prisma/models";

import { createId, prisma } from "../db/client";
import { shiftRepository } from "./shift.repository";

export interface SwapDraft {
  requesterId: string;
  targetId: string;
  date: IsoDate;
}

const NEWEST_FIRST = { createdAt: "desc" } as const;

/**
 * Thrown inside `approve`'s transaction to roll it back when the shift can no
 * longer be moved. Private to this module: callers see the `null` return.
 */
class ShiftNoLongerAvailable extends Error {}

function toSwapRequest(row: SwapRequestRow): SwapRequest {
  return {
    id: row.id,
    requesterId: row.requesterId,
    targetId: row.targetId,
    date: row.date,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
  };
}

export const swapRepository = {
  async list(): Promise<SwapRequest[]> {
    const rows = await prisma.swapRequest.findMany({ orderBy: NEWEST_FIRST });
    return rows.map(toSwapRequest);
  },

  async listForEmployee(employeeId: string): Promise<SwapRequest[]> {
    const rows = await prisma.swapRequest.findMany({
      where: { OR: [{ requesterId: employeeId }, { targetId: employeeId }] },
      orderBy: NEWEST_FIRST,
    });
    return rows.map(toSwapRequest);
  },

  async listByStatus(status: RequestStatus): Promise<SwapRequest[]> {
    const rows = await prisma.swapRequest.findMany({ where: { status }, orderBy: NEWEST_FIRST });
    return rows.map(toSwapRequest);
  },

  async findById(id: string): Promise<SwapRequest | null> {
    const row = await prisma.swapRequest.findUnique({ where: { id } });
    return row ? toSwapRequest(row) : null;
  },

  async create(draft: SwapDraft): Promise<SwapRequest> {
    const row = await prisma.swapRequest.create({
      data: {
        ...draft,
        id: createId("swap"),
        status: "pending",
        createdAt: new Date(),
        decidedAt: null,
      },
    });
    return toSwapRequest(row);
  },

  async decide(
    id: string,
    status: Exclude<RequestStatus, "pending">,
  ): Promise<SwapRequest | null> {
    // Same single-statement guard as `leaveRepository.decide`: approving a swap
    // moves a real shift, so it must not be possible to run the decision twice.
    const { count } = await prisma.swapRequest.updateMany({
      where: { id, status: "pending" },
      data: { status, decidedAt: new Date() },
    });
    if (count === 0) return null;

    return this.findById(id);
  },

  /**
   * Approval, which unlike a rejection has to move a real shift.
   *
   * The status change and the reassignment are one transaction, so the request
   * can never end up approved while the shift stayed on the requester's row —
   * either both land or neither does. The `status: "pending"` guard is the same
   * one `decide` uses, now inside the transaction, so the loser of a race
   * between two admins rolls its shift move back as well.
   *
   * Returns `null` when the swap could not be approved: it was already decided,
   * or the requester no longer holds a shift that day (an admin cleared or
   * moved it after the swap was raised). Either way nothing was written.
   */
  async approve(id: string): Promise<SwapRequest | null> {
    try {
      return await prisma.$transaction(async (tx) => {
        const { count } = await tx.swapRequest.updateMany({
          where: { id, status: "pending" },
          data: { status: "approved", decidedAt: new Date() },
        });
        if (count === 0) return null;

        const row = await tx.swapRequest.findUnique({ where: { id } });
        if (!row) return null;

        const moved = await shiftRepository.reassign(
          tx,
          row.requesterId,
          row.targetId,
          row.date,
        );
        if (!moved) throw new ShiftNoLongerAvailable();

        return toSwapRequest(row);
      });
    } catch (error) {
      // The rollback has happened by the time this runs; the request is still
      // pending, so an admin can retry once the shift is back.
      if (error instanceof ShiftNoLongerAvailable) return null;
      throw error;
    }
  },
};
