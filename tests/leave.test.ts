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
const { addIsoDays, todayIso } = await import("@/lib/date");
const { prisma } = await import("@/server/db/client");
const {
  MONDAY,
  createEmployee,
  createPendingSwap,
  createShift,
  resetDatabase,
} = await import("./support/fixtures");

const TUESDAY = "2026-08-04";

/**
 * Swaps are offered and accepted only for shifts still ahead, so the dates the
 * swap tests use are relative to today. `MONDAY` stays fixed — leave requests
 * carry no such rule.
 */
const TODAY = todayIso();
const TOMORROW = addIsoDays(TODAY, 1);
const NEXT_MONTH = addIsoDays(TODAY, 35);
const YESTERDAY = addIsoDays(TODAY, -1);

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

    const board = await getLeaveBoard(ADMIN);

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

    const board = await getLeaveBoard(STAFF);

    expect(board.viewerRole).toBe("staff");
    expect(board.leaveRows.map((r) => r.request.id)).toEqual(["leave-staff"]);
    expect(board.leaveRows.every((r) => !r.actionable)).toBe(true);
  });

  it("counts pending from the rows it shows", async () => {
    await createLeave("leave-1", STAFF_ID);
    await createLeave("leave-2", MATE_ID);
    await createLeave("leave-3", MATE_ID, "rejected");

    expect((await getLeaveBoard(ADMIN)).pendingLeaveCount).toBe(2);
    expect((await getLeaveBoard(STAFF)).pendingLeaveCount).toBe(1);
  });
});

describe("leave balance", () => {
  it("reports the employee's stored value untouched", async () => {
    expect((await getLeaveBoard(STAFF)).leaveBalance).toBe(14);
  });

  it("is not decremented by requesting or approving leave", async () => {
    // The screen presents the balance as informational, and this is why.
    await createLeave("leave-1", STAFF_ID);
    await decideLeaveAction("leave-1", "approved");

    expect((await getLeaveBoard(STAFF)).leaveBalance).toBe(14);
  });
});

describe("swap options offered to staff", () => {
  it("offers only shifts the person actually holds", async () => {
    await createShift(STAFF_ID, TOMORROW);
    await createShift(MATE_ID, TOMORROW);

    const board = await getLeaveBoard(STAFF);

    expect(board.mySwapOptions.map((o) => o.date)).toEqual([TOMORROW]);
  });

  it("reaches past the current week, as far as the roster is written", async () => {
    await createShift(STAFF_ID, TOMORROW);
    await createShift(STAFF_ID, NEXT_MONTH);

    const board = await getLeaveBoard(STAFF);

    // The screen has no week switcher; every shift still to be worked is here.
    expect(board.mySwapOptions.map((o) => o.date)).toEqual([TOMORROW, NEXT_MONTH]);
  });

  it("drops today and everything before it", async () => {
    await createShift(STAFF_ID, YESTERDAY);
    await createShift(STAFF_ID, TODAY);
    await createShift(STAFF_ID, TOMORROW);

    const board = await getLeaveBoard(STAFF);

    // Today's shift is already under way; yesterday's has been worked.
    expect(board.mySwapOptions.map((o) => o.date)).toEqual([TOMORROW]);
  });

  it("carries the real times, not just the date", async () => {
    await createShift(STAFF_ID, TOMORROW, 11 * 60, 19 * 60);

    const [option] = (await getLeaveBoard(STAFF)).mySwapOptions;

    expect(option.shift).toMatchObject({ startMinutes: 11 * 60, endMinutes: 19 * 60 });
  });

  it("offers an admin nothing — they hold no roster row", async () => {
    await createShift(ADMIN_ID, TOMORROW);

    expect((await getLeaveBoard(ADMIN)).mySwapOptions).toEqual([]);
  });

  it("offers colleagues but never the viewer", async () => {
    const board = await getLeaveBoard(STAFF);
    const ids = board.colleagues.map((c) => c.id);
    expect(ids).not.toContain(STAFF_ID);
    expect(ids).toContain(MATE_ID);
  });

  it("never offers the admin as a swap target", async () => {
    // An admin has no roster row, so a shift handed to one would vanish from
    // the timetable rather than change hands.
    const board = await getLeaveBoard(STAFF);
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

describe("swap rules", () => {
  it("creates a swap only for a shift the requester holds", async () => {
    await createShift(STAFF_ID, TOMORROW);

    expect(
      await createSwapRequestAction(null, form({ date: TOMORROW, targetId: MATE_ID })),
    ).toEqual({ ok: true });
  });

  it("refuses when the requester has no shift that day", async () => {
    expect(
      await createSwapRequestAction(null, form({ date: TOMORROW, targetId: MATE_ID })),
    ).toEqual({ ok: false, error: "notFound" });
  });

  it("refuses a swap with yourself", async () => {
    await createShift(STAFF_ID, TOMORROW);
    expect(
      await createSwapRequestAction(null, form({ date: TOMORROW, targetId: STAFF_ID })),
    ).toEqual({ ok: false, error: "notFound" });
  });

  it("accepts a shift well past the current week", async () => {
    await createShift(STAFF_ID, NEXT_MONTH);

    expect(
      await createSwapRequestAction(null, form({ date: NEXT_MONTH, targetId: MATE_ID })),
    ).toEqual({ ok: true });
  });

  it("refuses today's shift and writes nothing", async () => {
    // The select never offers it, but a page left open overnight would.
    await createShift(STAFF_ID, TODAY);

    expect(
      await createSwapRequestAction(null, form({ date: TODAY, targetId: MATE_ID })),
    ).toEqual({ ok: false, error: "shiftPassed" });
    expect(await prisma.swapRequest.count()).toBe(0);
  });

  it("refuses a shift already worked", async () => {
    await createShift(STAFF_ID, YESTERDAY);

    expect(
      await createSwapRequestAction(null, form({ date: YESTERDAY, targetId: MATE_ID })),
    ).toEqual({ ok: false, error: "shiftPassed" });
  });

  it("moves the shift on approval", async () => {
    await createShift(STAFF_ID, TOMORROW);
    await createPendingSwap("swap-1", STAFF_ID, MATE_ID, TOMORROW);

    expect(await decideSwapAction("swap-1", "approved")).toEqual({ ok: true });
    expect(
      await prisma.shift.findUnique({
        where: { employeeId_date: { employeeId: MATE_ID, date: TOMORROW } },
      }),
    ).not.toBeNull();
  });
});

describe("the swap list resolves its own shifts", () => {
  it("shows the times of a request weeks out, not a dash", async () => {
    // The lookup used to run over one loaded week, so anything outside it lost
    // its hours on the way to the admin deciding it.
    await createShift(STAFF_ID, NEXT_MONTH, 12 * 60, 20 * 60);
    await createPendingSwap("swap-far", STAFF_ID, MATE_ID, NEXT_MONTH);

    const [row] = (await getLeaveBoard(ADMIN)).swapRows;

    expect(row.shift).toMatchObject({ startMinutes: 12 * 60, endMinutes: 20 * 60 });
  });

  it("leaves the shift null once it is gone", async () => {
    await createPendingSwap("swap-gone", STAFF_ID, MATE_ID, NEXT_MONTH);

    const [row] = (await getLeaveBoard(ADMIN)).swapRows;

    expect(row.shift).toBeNull();
  });

  it("never pairs a request with someone else's shift on that day", async () => {
    await createShift(MATE_ID, NEXT_MONTH);
    await createPendingSwap("swap-1", STAFF_ID, MATE_ID, NEXT_MONTH);

    const [row] = (await getLeaveBoard(ADMIN)).swapRows;

    expect(row.shift).toBeNull();
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

  it("explains a stale swap option in both locales", () => {
    for (const locale of ["tr", "en"] as const) {
      expect(getDictionary(locale).leave.swapPast).toBeTruthy();
      expect(getDictionary(locale).leave.swapNoShift).toBeTruthy();
    }
  });
});
