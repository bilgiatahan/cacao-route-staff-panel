/**
 * Swap approval must be all-or-nothing.
 *
 * The bug these cover: `decideSwapAction` marked a request approved, then called
 * `shiftRepository.reassign` and discarded its `false` return, so a swap could
 * be persisted as approved — and announced to everyone — with the shift still
 * sitting on the requester's row.
 *
 * These run against a real Postgres because the fix is a transaction; a mocked
 * client would assert on the mock rather than on rollback actually happening.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "@/lib/auth-error";
import type { SessionUser } from "@/types/domain";

const ADMIN: SessionUser = {
  userId: "user-admin",
  employeeId: "emp-admin",
  email: "admin@example.test",
  role: "admin",
  fullName: "Admin Test",
};

// `refresh()` only works inside a real Server Action invocation.
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

// The action's authorization is exercised in its own describe block below;
// everywhere else the caller is a signed-in admin.
const assertAdmin = vi.fn(async () => ADMIN);
const assertAuthenticated = vi.fn(async () => ADMIN);
vi.mock("@/server/auth/session", () => ({
  assertAdmin: () => assertAdmin(),
  assertAuthenticated: () => assertAuthenticated(),
}));

const { decideSwapAction } = await import("@/server/actions/swap.actions");
const { swapRepository } = await import("@/server/repositories/swap.repository");
const { shiftRepository } = await import("@/server/repositories/shift.repository");
const { prisma } = await import("@/server/db/client");
const {
  MONDAY,
  countNotifications,
  createEmployee,
  createPendingSwap,
  createShift,
  resetDatabase,
  shiftOwnerOn,
  swapStatusOf,
} = await import("./support/fixtures");

const REQUESTER = "emp-requester";
const TARGET = "emp-target";
const SWAP = "swap-1";

beforeEach(async () => {
  vi.clearAllMocks();
  assertAdmin.mockImplementation(async () => ADMIN);
  await resetDatabase();
  await createEmployee("emp-admin", "Admin", { role: "admin", sortOrder: 0 });
  await createEmployee(REQUESTER, "Requester", { sortOrder: 1 });
  await createEmployee(TARGET, "Target", { sortOrder: 2 });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("successful approval", () => {
  it("approves the request, moves the shift, notifies, and reports success", async () => {
    await createShift(REQUESTER, MONDAY);
    await createPendingSwap(SWAP, REQUESTER, TARGET, MONDAY);

    const result = await decideSwapAction(SWAP, "approved");

    expect(result).toEqual({ ok: true });
    expect(await swapStatusOf(SWAP)).toBe("approved");
    expect(await shiftOwnerOn(MONDAY, TARGET)).not.toBeNull();
    expect(await shiftOwnerOn(MONDAY, REQUESTER)).toBeNull();
    expect(await countNotifications()).toBe(1);
  });

  it("stamps decidedAt when it approves", async () => {
    await createShift(REQUESTER, MONDAY);
    await createPendingSwap(SWAP, REQUESTER, TARGET, MONDAY);

    await decideSwapAction(SWAP, "approved");

    const row = await prisma.swapRequest.findUnique({ where: { id: SWAP } });
    expect(row?.decidedAt).toBeInstanceOf(Date);
  });

  it("replaces a shift the target already held that day", async () => {
    // The [employeeId, date] unique index rejects the move unless the target's
    // own shift is deleted in the same transaction.
    await createShift(REQUESTER, MONDAY, 9 * 60, 17 * 60);
    await createShift(TARGET, MONDAY, 12 * 60, 20 * 60);
    await createPendingSwap(SWAP, REQUESTER, TARGET, MONDAY);

    const result = await decideSwapAction(SWAP, "approved");

    expect(result).toEqual({ ok: true });
    const moved = await shiftOwnerOn(MONDAY, TARGET);
    expect(moved?.startMinutes).toBe(9 * 60); // the requester's shift, not the target's
    expect(await prisma.shift.count({ where: { date: MONDAY } })).toBe(1);
  });
});

describe("reassignment cannot be applied", () => {
  it("does not report success when the requester no longer holds the shift", async () => {
    // No shift for the requester: an admin cleared it after the swap was raised.
    await createPendingSwap(SWAP, REQUESTER, TARGET, MONDAY);

    const result = await decideSwapAction(SWAP, "approved");

    expect(result).toEqual({ ok: false, error: "notFound" });
  });

  it("leaves the request pending rather than approved", async () => {
    await createPendingSwap(SWAP, REQUESTER, TARGET, MONDAY);

    await decideSwapAction(SWAP, "approved");

    // The regression: this used to read "approved" with no shift behind it.
    expect(await swapStatusOf(SWAP)).toBe("pending");
    const row = await prisma.swapRequest.findUnique({ where: { id: SWAP } });
    expect(row?.decidedAt).toBeNull();
  });

  it("creates no notification", async () => {
    await createPendingSwap(SWAP, REQUESTER, TARGET, MONDAY);

    await decideSwapAction(SWAP, "approved");

    expect(await countNotifications()).toBe(0);
  });

  it("moves no shift onto the target", async () => {
    await createPendingSwap(SWAP, REQUESTER, TARGET, MONDAY);

    await decideSwapAction(SWAP, "approved");

    expect(await shiftOwnerOn(MONDAY, TARGET)).toBeNull();
  });

  it("rolls back a shift the target already held", async () => {
    // The target's own shift must survive: the whole transaction rolled back.
    await createShift(TARGET, MONDAY, 12 * 60, 20 * 60);
    await createPendingSwap(SWAP, REQUESTER, TARGET, MONDAY);

    const result = await decideSwapAction(SWAP, "approved");

    expect(result).toEqual({ ok: false, error: "notFound" });
    const kept = await shiftOwnerOn(MONDAY, TARGET);
    expect(kept?.startMinutes).toBe(12 * 60);
    expect(await swapStatusOf(SWAP)).toBe("pending");
  });

  it("is retryable once the shift is back", async () => {
    await createPendingSwap(SWAP, REQUESTER, TARGET, MONDAY);
    expect(await decideSwapAction(SWAP, "approved")).toEqual({ ok: false, error: "notFound" });

    await createShift(REQUESTER, MONDAY);

    expect(await decideSwapAction(SWAP, "approved")).toEqual({ ok: true });
    expect(await swapStatusOf(SWAP)).toBe("approved");
  });
});

describe("stale and concurrent decisions", () => {
  it("refuses a second decision on an already-approved request", async () => {
    await createShift(REQUESTER, MONDAY);
    await createPendingSwap(SWAP, REQUESTER, TARGET, MONDAY);
    await decideSwapAction(SWAP, "approved");
    const notificationsAfterFirst = await countNotifications();

    const second = await decideSwapAction(SWAP, "approved");

    expect(second).toEqual({ ok: false, error: "notFound" });
    expect(await countNotifications()).toBe(notificationsAfterFirst);
  });

  it("refuses to reject a request that was already approved", async () => {
    await createShift(REQUESTER, MONDAY);
    await createPendingSwap(SWAP, REQUESTER, TARGET, MONDAY);
    await decideSwapAction(SWAP, "approved");

    const result = await decideSwapAction(SWAP, "rejected");

    expect(result).toEqual({ ok: false, error: "notFound" });
    expect(await swapStatusOf(SWAP)).toBe("approved");
    // The approved shift must not be dragged back by the losing decision.
    expect(await shiftOwnerOn(MONDAY, TARGET)).not.toBeNull();
  });

  it("lets only one of two concurrent approvals win", async () => {
    await createShift(REQUESTER, MONDAY);
    await createPendingSwap(SWAP, REQUESTER, TARGET, MONDAY);

    const [a, b] = await Promise.all([
      decideSwapAction(SWAP, "approved"),
      decideSwapAction(SWAP, "approved"),
    ]);

    const succeeded = [a, b].filter((result) => result.ok);
    expect(succeeded).toHaveLength(1);
    expect(await swapStatusOf(SWAP)).toBe("approved");
    expect(await countNotifications()).toBe(1);
    expect(await prisma.shift.count({ where: { date: MONDAY } })).toBe(1);
  });

  it("returns notFound for a request that does not exist", async () => {
    expect(await decideSwapAction("swap-missing", "approved")).toEqual({
      ok: false,
      error: "notFound",
    });
  });
});

describe("rejection is unchanged", () => {
  it("rejects the request, notifies, and leaves the shift alone", async () => {
    await createShift(REQUESTER, MONDAY);
    await createPendingSwap(SWAP, REQUESTER, TARGET, MONDAY);

    const result = await decideSwapAction(SWAP, "rejected");

    expect(result).toEqual({ ok: true });
    expect(await swapStatusOf(SWAP)).toBe("rejected");
    expect(await shiftOwnerOn(MONDAY, REQUESTER)).not.toBeNull();
    expect(await shiftOwnerOn(MONDAY, TARGET)).toBeNull();
    expect(await countNotifications()).toBe(1);
  });

  it("rejects even when the requester's shift is already gone", async () => {
    // Rejection moves nothing, so the missing shift must not block it.
    await createPendingSwap(SWAP, REQUESTER, TARGET, MONDAY);

    const result = await decideSwapAction(SWAP, "rejected");

    expect(result).toEqual({ ok: true });
    expect(await swapStatusOf(SWAP)).toBe("rejected");
  });
});

describe("authorization is unchanged", () => {
  it("does not decide when the caller is not an admin", async () => {
    assertAdmin.mockImplementation(async () => {
      throw new AuthorizationError("forbidden");
    });
    await createShift(REQUESTER, MONDAY);
    await createPendingSwap(SWAP, REQUESTER, TARGET, MONDAY);

    const result = await decideSwapAction(SWAP, "approved");

    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(await swapStatusOf(SWAP)).toBe("pending");
    expect(await shiftOwnerOn(MONDAY, TARGET)).toBeNull();
    expect(await countNotifications()).toBe(0);
  });
});

describe("swapRepository.approve", () => {
  it("returns the approved request when the shift moves", async () => {
    await createShift(REQUESTER, MONDAY);
    await createPendingSwap(SWAP, REQUESTER, TARGET, MONDAY);

    const request = await swapRepository.approve(SWAP);

    expect(request?.status).toBe("approved");
    expect(request?.id).toBe(SWAP);
  });

  it("returns null and writes nothing when there is no shift to move", async () => {
    await createPendingSwap(SWAP, REQUESTER, TARGET, MONDAY);

    expect(await swapRepository.approve(SWAP)).toBeNull();
    expect(await swapStatusOf(SWAP)).toBe("pending");
  });

  it("returns null for an already-decided request", async () => {
    await createShift(REQUESTER, MONDAY);
    await createPendingSwap(SWAP, REQUESTER, TARGET, MONDAY);
    await swapRepository.approve(SWAP);

    expect(await swapRepository.approve(SWAP)).toBeNull();
  });
});

describe("shiftRepository.reassign", () => {
  it("reports false inside a caller's transaction when the source has no shift", async () => {
    const moved = await prisma.$transaction((tx) =>
      shiftRepository.reassign(tx, REQUESTER, TARGET, MONDAY),
    );

    expect(moved).toBe(false);
  });

  it("moves the shift and reports true", async () => {
    await createShift(REQUESTER, MONDAY);

    const moved = await prisma.$transaction((tx) =>
      shiftRepository.reassign(tx, REQUESTER, TARGET, MONDAY),
    );

    expect(moved).toBe(true);
    expect(await shiftOwnerOn(MONDAY, TARGET)).not.toBeNull();
    expect(await shiftOwnerOn(MONDAY, REQUESTER)).toBeNull();
  });
});
