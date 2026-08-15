import "server-only";

import type { IsoDate, RequestStatus, SwapRequest } from "@/types/domain";
import type { SwapRequestModel as SwapRequestRow } from "@/generated/prisma/models";

import { createId, prisma } from "../db/client";

export interface SwapDraft {
  requesterId: string;
  targetId: string;
  date: IsoDate;
}

const NEWEST_FIRST = { createdAt: "desc" } as const;

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
};
