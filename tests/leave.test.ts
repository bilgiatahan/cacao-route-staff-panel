/**
 * Leave screen data and actions, pinned across the migration.
 *
 * The migration was presentational, so these assert the board underneath it did
 * not move: the staff/admin split, who may act on what, the balance value, the
 * pending count, status mapping, and the request/swap creation rules.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "@/lib/auth-error";
import type { SessionUser } from "@/types/domain";

const ADMIN_ID = "emp-admin";
const STAFF_ID = "emp-staff";
const MATE_ID = "emp-mate";

const ADMIN: SessionUser = {
  userId: "u-admin",
  employeeId: ADMIN_ID,
  email: "admin@example.test",
  role: "admin",
  fullName: "Admin Test",
};
const STAFF: SessionUser = { ...ADMIN, userId: "u-staff", employeeId: STAFF_ID, role: "staff" };

vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const assertAdmin = vi.fn(async () => ADMIN);
const assertAuthenticated = vi.fn(async () => STAFF);
vi.mock("@/server/auth/session", () => ({
  assertAdmin: () => assertAdmin(),
  assertAuthenticated: () => assertAuthenticated(),
}));

const { getLeaveBoard } = await import("@/server/services/leave.service");
const { createLeaveRequestAction, decideLeaveAction } = await import(
  "@/server/actions/leave.actions"
);
const { createSwapRequestAction, decideSwapAction } = await import(
  "@/server/actions/swap.actions"
);
const { getDictionary } = await import("@/lib/i18n");
const { prisma } = await import("@/server/db/client");
const {
  MONDAY,
  createEmployee,
  createPendingSwap,
  createShift,
  resetDatabase,
} = await import("./support/fixtures");

const TUESDAY = "2026-08-04";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

async function createLeave(
  id: string,
  employeeId: string,
  status: "pending" | "approved" | "rejected" = "pending",
) {
  await prisma.leaveRequest.create({
    data: {
      id,
      employeeId,
      type: "annual",
      startDate: MONDAY,
      endDate: TUESDAY,
      note: "",
      status,
      createdAt: new Date(),
      decidedAt: status === "pending" ? null : new Date(),
      decidedByEmployeeId: status === "pending" ? null : ADMIN_ID,
    },
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  assertAdmin.mockImplementation(async () => ADMIN);
  assertAuthenticated.mockImplementation(async () => STAFF);
  await resetDatabase();
  await createEmployee(ADMIN_ID, "Admin", { role: "admin", sortOrder: 0 });
  await createEmployee(STAFF_ID, "Staff", { sortOrder: 1 });
  await createEmployee(MATE_ID, "Mate", { sortOrder: 2 });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("the board splits by role", () => {
  it("shows an admin every request and lets them act on pending ones", async () => {
    await createLeave("leave-staff", STAFF_ID);
    await createLeave("leave-mate", MATE_ID, "approved");

    const board = await getLeaveBoard(ADMIN, MONDAY);

    expect(board.viewerRole).toBe("admin");
    expect(board.leaveRows).toHaveLength(2);
    const pending = board.leaveRows.find((r) => r.request.id === "leave-staff");
    const decided = board.leaveRows.find((r) => r.request.id === "leave-mate");
    expect(pending?.actionable).toBe(true);
    expect(decided?.actionable).toBe(false);
  });

  it("shows staff only their own requests, and never lets them act", async () => {
    await createLeave("leave-staff", STAFF_ID);
    await createLeave("leave-mate", MATE_ID);

    const board = await getLeaveBoard(STAFF, MONDAY);

    expect(board.viewerRole).toBe("staff");
    expect(board.leaveRows.map((r) => r.request.id)).toEqual(["leave-staff"]);
    expect(board.leaveRows.every((r) => !r.actionable)).toBe(true);
  });

  it("counts pending from the rows it shows", async () => {
    await createLeave("leave-1", STAFF_ID);
    await createLeave("leave-2", MATE_ID);
    await createLeave("leave-3", MATE_ID, "rejected");

    expect((await getLeaveBoard(ADMIN, MONDAY)).pendingLeaveCount).toBe(2);
    expect((await getLeaveBoard(STAFF, MONDAY)).pendingLeaveCount).toBe(1);
  });
});

describe("leave balance", () => {
  it("reports the employee's stored value untouched", async () => {
    expect((await getLeaveBoard(STAFF, MONDAY)).leaveBalance).toBe(14);
  });

  it("is not decremented by requesting or approving leave", async () => {
    // The screen presents the balance as informational, and this is why.
    await createLeave("leave-1", STAFF_ID);
    await decideLeaveAction("leave-1", "approved");

    expect((await getLeaveBoard(STAFF, MONDAY)).leaveBalance).toBe(14);
  });
});

describe("swap options offered to staff", () => {
  it("offers only shifts the person actually holds this week", async () => {
    await createShift(STAFF_ID, MONDAY);
    await createShift(MATE_ID, TUESDAY);

    const board = await getLeaveBoard(STAFF, MONDAY);

    expect(board.mySwapOptions.map((o) => o.date)).toEqual([MONDAY]);
  });

  it("offers colleagues but never the viewer", async () => {
    const board = await getLeaveBoard(STAFF, MONDAY);
    const ids = board.colleagues.map((c) => c.id);
    expect(ids).not.toContain(STAFF_ID);
    expect(ids).toContain(MATE_ID);
  });

  it("never offers the admin as a swap target", async () => {
    // An admin has no roster row, so a shift handed to one would vanish from
    // the timetable rather than change hands.
    const board = await getLeaveBoard(STAFF, MONDAY);
    expect(board.colleagues.map((c) => c.id)).not.toContain(ADMIN_ID);
  });
});

describe("creating a leave request", () => {
  it("succeeds for a valid range", async () => {
    const result = await createLeaveRequestAction(
      null,
      form({ type: "sick", startDate: MONDAY, endDate: TUESDAY, note: "flu" }),
    );

    expect(result).toEqual({ ok: true });
    const row = await prisma.leaveRequest.findFirst({ where: { employeeId: STAFF_ID } });
    expect(row?.type).toBe("sick");
    expect(row?.status).toBe("pending");
    expect(row?.note).toBe("flu");
  });

  it("rejects an end date before the start", async () => {
    expect(
      await createLeaveRequestAction(
        null,
        form({ type: "annual", startDate: TUESDAY, endDate: MONDAY }),
      ),
    ).toEqual({ ok: false, error: "invalidRange" });
  });

  it("rejects a malformed date", async () => {
    expect(
      await createLeaveRequestAction(
        null,
        form({ type: "annual", startDate: "nope", endDate: TUESDAY }),
      ),
    ).toEqual({ ok: false, error: "invalidRange" });
  });

  it("still does not check the balance", async () => {
    // Not a regression: the screen's wording was changed to stop implying it.
    await prisma.employee.update({ where: { id: STAFF_ID }, data: { leaveBalance: 0 } });

    expect(
      await createLeaveRequestAction(
        null,
        form({ type: "annual", startDate: MONDAY, endDate: TUESDAY }),
      ),
    ).toEqual({ ok: true });
  });

  it("always files against the session, never the form", async () => {
    await createLeaveRequestAction(
      null,
      form({ employeeId: MATE_ID, type: "annual", startDate: MONDAY, endDate: MONDAY }),
    );

    const row = await prisma.leaveRequest.findFirst();
    expect(row?.employeeId).toBe(STAFF_ID);
  });
});

describe("admin decisions", () => {
  it("approves and rejects a pending request", async () => {
    await createLeave("leave-1", STAFF_ID);
    expect(await decideLeaveAction("leave-1", "approved")).toEqual({ ok: true });

    await createLeave("leave-2", MATE_ID);
    expect(await decideLeaveAction("leave-2", "rejected")).toEqual({ ok: true });

    const rows = await prisma.leaveRequest.findMany({ orderBy: { id: "asc" } });
    expect(rows.map((r) => r.status)).toEqual(["approved", "rejected"]);
  });

  it("refuses a non-admin and changes nothing", async () => {
    assertAdmin.mockImplementation(async () => {
      throw new AuthorizationError("forbidden");
    });
    await createLeave("leave-1", STAFF_ID);

    expect(await decideLeaveAction("leave-1", "approved")).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(
      (await prisma.leaveRequest.findUnique({ where: { id: "leave-1" } }))?.status,
    ).toBe("pending");
  });
});

describe("swap rules are unchanged", () => {
  it("creates a swap only for a shift the requester holds", async () => {
    await createShift(STAFF_ID, MONDAY);

    expect(
      await createSwapRequestAction(null, form({ date: MONDAY, targetId: MATE_ID })),
    ).toEqual({ ok: true });
  });

  it("refuses when the requester has no shift that day", async () => {
    expect(
      await createSwapRequestAction(null, form({ date: MONDAY, targetId: MATE_ID })),
    ).toEqual({ ok: false, error: "notFound" });
  });

  it("refuses a swap with yourself", async () => {
    await createShift(STAFF_ID, MONDAY);
    expect(
      await createSwapRequestAction(null, form({ date: MONDAY, targetId: STAFF_ID })),
    ).toEqual({ ok: false, error: "notFound" });
  });

  it("moves the shift on approval", async () => {
    await createShift(STAFF_ID, MONDAY);
    await createPendingSwap("swap-1", STAFF_ID, MATE_ID, MONDAY);

    expect(await decideSwapAction("swap-1", "approved")).toEqual({ ok: true });
    expect(
      await prisma.shift.findUnique({
        where: { employeeId_date: { employeeId: MATE_ID, date: MONDAY } },
      }),
    ).not.toBeNull();
  });
});

describe("status labels the badges render", () => {
  it("names all three states in both locales", () => {
    for (const locale of ["tr", "en"] as const) {
      const { status, types } = getDictionary(locale).leave;
      for (const label of [status.pending, status.approved, status.rejected]) {
        expect(label).toBeTruthy();
      }
      for (const label of [types.annual, types.sick, types.excuse]) {
        expect(label).toBeTruthy();
      }
    }
  });

  it("has the new balance hint and note label in both locales", () => {
    for (const locale of ["tr", "en"] as const) {
      expect(getDictionary(locale).leave.balanceHint).toBeTruthy();
      expect(getDictionary(locale).leave.note).toBeTruthy();
    }
  });
});
