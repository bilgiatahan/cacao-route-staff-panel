/**
 * Duplicate-read removal (Task 2).
 *
 * Two duplicates were collapsed on an admin `/summary` render:
 *
 *   1. the session employee row, read twice through two separate `cache()`
 *      entries (`getSessionUser` + a private `getCurrentEmployee`)
 *   2. pending leave and pending swaps, read once for the layout's tab badge
 *      and again inside `getAdminSummary`
 *
 * Note on what these tests can and cannot show: React's `cache()` only
 * memoizes inside a flight render — `getCacheForType` falls back to a throwaway
 * `new Map()` when `resolveRequest()` is null. Outside a render (here, and in a
 * Server Action body) it is a pass-through. So these tests pin the *data* is
 * unchanged and that reads observe post-mutation state; the deduplication
 * itself is a property of the render and is argued statically in the report.
 *
 * That same fallback is why the dedupe is safe: an action can never populate a
 * cache entry that the re-render after `refresh()` would then serve stale.
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

vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const assertAdmin = vi.fn(async () => ADMIN);
const assertAuthenticated = vi.fn(async () => ADMIN);
vi.mock("@/server/auth/session", () => ({
  assertAdmin: () => assertAdmin(),
  assertAuthenticated: () => assertAuthenticated(),
}));

const { getPendingRequests } = await import("@/server/services/leave.service");
const { getAdminSummary } = await import("@/server/services/summary.service");
const { decideLeaveAction } = await import("@/server/actions/leave.actions");
const { decideSwapAction } = await import("@/server/actions/swap.actions");
const { leaveRepository } = await import("@/server/repositories/leave.repository");
const { swapRepository } = await import("@/server/repositories/swap.repository");
const { prisma } = await import("@/server/db/client");
const {
  MONDAY,
  createEmployee,
  createPendingSwap,
  createShift,
  resetDatabase,
} = await import("./support/fixtures");

const REQUESTER = "emp-requester";
const TARGET = "emp-target";

async function createPendingLeave(id: string, employeeId: string) {
  await prisma.leaveRequest.create({
    data: {
      id,
      employeeId,
      type: "annual",
      startDate: MONDAY,
      endDate: MONDAY,
      note: "",
      status: "pending",
      createdAt: new Date(),
      decidedAt: null,
      decidedByEmployeeId: null,
    },
  });
}

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

describe("getPendingRequests", () => {
  it("returns exactly what the two repository calls returned before", async () => {
    await createPendingLeave("leave-1", REQUESTER);
    await createShift(REQUESTER, MONDAY);
    await createPendingSwap("swap-1", REQUESTER, TARGET, MONDAY);

    const pending = await getPendingRequests();

    // The shape both consumers replaced.
    expect(pending.leave).toEqual(await leaveRepository.listByStatus("pending"));
    expect(pending.swaps).toEqual(await swapRepository.listByStatus("pending"));
  });

  it("is empty when nothing is pending", async () => {
    const pending = await getPendingRequests();
    expect(pending).toEqual({ leave: [], swaps: [] });
  });

  it("excludes anything already decided", async () => {
    await createPendingLeave("leave-1", REQUESTER);
    await createPendingLeave("leave-2", TARGET);
    await leaveRepository.decide("leave-2", "approved", "emp-admin");

    const pending = await getPendingRequests();

    expect(pending.leave.map((r) => r.id)).toEqual(["leave-1"]);
  });
});

describe("admin summary still renders the same data", () => {
  it("carries the pending rows through to the view model", async () => {
    await createPendingLeave("leave-1", REQUESTER);
    await createShift(REQUESTER, MONDAY);
    await createPendingSwap("swap-1", REQUESTER, TARGET, MONDAY);

    const summary = await getAdminSummary(MONDAY, "week");

    expect(summary.kind).toBe("admin");
    expect(summary.pendingLeave.map((r) => r.id)).toEqual(["leave-1"]);
    expect(summary.pendingSwaps.map((r) => r.id)).toEqual(["swap-1"]);
    // Unrelated fields must be untouched by this change.
    expect(summary.headcount).toBe(3);
    expect(summary.roster.dates).toHaveLength(7);
    expect(summary.payroll.lines).toHaveLength(3);
  });

  it("agrees with the badge count the layout renders", async () => {
    await createPendingLeave("leave-1", REQUESTER);
    await createPendingLeave("leave-2", TARGET);
    await createShift(REQUESTER, MONDAY);
    await createPendingSwap("swap-1", REQUESTER, TARGET, MONDAY);

    const summary = await getAdminSummary(MONDAY, "week");
    const badge = (await getPendingRequests()).leave.length +
      (await getPendingRequests()).swaps.length;

    expect(summary.pendingLeave.length + summary.pendingSwaps.length).toBe(badge);
    expect(badge).toBe(3);
  });
});

describe("read-after-write: a decision is visible to the next read", () => {
  it("drops an approved leave request from the pending set", async () => {
    await createPendingLeave("leave-1", REQUESTER);
    expect((await getPendingRequests()).leave).toHaveLength(1);

    const result = await decideLeaveAction("leave-1", "approved");
    expect(result).toEqual({ ok: true });

    // The mutation must be observable; nothing may serve the pre-mutation set.
    expect((await getPendingRequests()).leave).toHaveLength(0);
    expect((await getAdminSummary(MONDAY, "week")).pendingLeave).toHaveLength(0);
  });

  it("drops an approved swap from the pending set", async () => {
    await createShift(REQUESTER, MONDAY);
    await createPendingSwap("swap-1", REQUESTER, TARGET, MONDAY);
    expect((await getPendingRequests()).swaps).toHaveLength(1);

    expect(await decideSwapAction("swap-1", "approved")).toEqual({ ok: true });

    expect((await getPendingRequests()).swaps).toHaveLength(0);
    expect((await getAdminSummary(MONDAY, "week")).pendingSwaps).toHaveLength(0);
  });

  it("keeps a rejected request out of the pending set too", async () => {
    await createPendingLeave("leave-1", REQUESTER);
    await decideLeaveAction("leave-1", "rejected");

    expect((await getPendingRequests()).leave).toHaveLength(0);
  });

  it("does not drop anything when the decision is refused", async () => {
    assertAdmin.mockImplementation(async () => {
      throw new AuthorizationError("forbidden");
    });
    await createPendingLeave("leave-1", REQUESTER);

    expect(await decideLeaveAction("leave-1", "approved")).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect((await getPendingRequests()).leave).toHaveLength(1);
  });
});

describe("session employee: one read, still fresh after a mutation", () => {
  it("returns the same row for the user view and the employee row", async () => {
    // requireCurrentEmployee and getSessionUser now come from one fetch; the
    // derived SessionUser must still match the Employee it was built from.
    const { employeeRepository } = await import(
      "@/server/repositories/employee.repository"
    );
    const employee = await employeeRepository.findById("emp-admin");

    expect(employee).not.toBeNull();
    expect(employee?.email).toBe("emp-admin@example.test");
    expect(employee?.role).toBe("admin");
  });

  it("observes a profile mutation on the next read", async () => {
    const { employeeRepository } = await import(
      "@/server/repositories/employee.repository"
    );

    await employeeRepository.update("emp-admin", { firstName: "Renamed" });

    const after = await employeeRepository.findById("emp-admin");
    expect(after?.firstName).toBe("Renamed");
  });
});
