/**
 * Summary screen data, pinned across the migration.
 *
 * The migration was presentational, so these assert the numbers behind it did
 * not move: the admin and staff branches return different shapes, pending counts
 * come from the same cached read the nav badge uses, and the period switch
 * projects a week onto a month without touching the underlying hours.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const { getAdminSummary, getStaffSummary } = await import(
  "@/server/services/summary.service"
);
const { getPendingRequests } = await import("@/server/services/leave.service");
const { prisma } = await import("@/server/db/client");
const {
  MONDAY,
  createEmployee,
  createPendingSwap,
  createShift,
  resetDatabase,
} = await import("./support/fixtures");

const ADMIN = "emp-admin";
const STAFF = "emp-staff";
const SUNDAY = "2026-08-09";

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
  await resetDatabase();
  await createEmployee(ADMIN, "Admin", { role: "admin", sortOrder: 0 });
  await createEmployee(STAFF, "Staff", { sortOrder: 1 });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("admin branch", () => {
  it("reports headcount, hours and cost for the week", async () => {
    // Admins are not roster members, so the 4h below is deliberately ignored:
    // headcount, hours and cost all describe the people who work the shifts.
    await createShift(STAFF, MONDAY, 9 * 60, 17 * 60); // 8h @ 130
    await createShift(ADMIN, MONDAY, 9 * 60, 13 * 60); // 4h @ 130, excluded

    const summary = await getAdminSummary(MONDAY, "week");

    expect(summary.kind).toBe("admin");
    expect(summary.headcount).toBe(1);
    expect(summary.payroll.totalHours).toBe(8);
    expect(summary.payroll.totalCost).toBe(8 * 130);
    expect(summary.weeksInPeriod).toBe(1);
  });

  it("gives the admin no roster row, empty or otherwise", async () => {
    await createShift(STAFF, MONDAY, 9 * 60, 17 * 60);

    const summary = await getAdminSummary(MONDAY, "week");
    const ids = summary.roster.rows.map((row) => row.employee.id);

    expect(ids).toEqual([STAFF]);
    expect(summary.roster.staffRows.map((row) => row.employee.id)).toEqual([STAFF]);
    expect(summary.payroll.lines.map((line) => line.employee.id)).toEqual([STAFF]);
    // The directory keeps them: pending requests still need a name to show.
    expect(summary.roster.employees.map((e) => e.id)).toContain(ADMIN);
  });

  it("projects onto the month without changing the week's shifts", async () => {
    await createShift(STAFF, MONDAY, 9 * 60, 17 * 60);

    const week = await getAdminSummary(MONDAY, "week");
    const month = await getAdminSummary(MONDAY, "month");

    expect(month.weeksInPeriod).toBeGreaterThan(1);
    expect(month.payroll.totalHours).toBe(week.payroll.totalHours * month.weeksInPeriod);
    // The roster itself is the same week either way.
    expect(month.roster.shifts).toHaveLength(week.roster.shifts.length);
  });

  it("carries the same pending rows the nav badge counts", async () => {
    await createPendingLeave("leave-1", STAFF);
    await createShift(STAFF, MONDAY);
    await createPendingSwap("swap-1", STAFF, ADMIN, MONDAY);

    const summary = await getAdminSummary(MONDAY, "week");
    const pending = await getPendingRequests();

    expect(summary.pendingLeave.map((r) => r.id)).toEqual(
      pending.leave.map((r) => r.id),
    );
    expect(summary.pendingSwaps.map((r) => r.id)).toEqual(
      pending.swaps.map((r) => r.id),
    );
    expect(summary.pendingLeave.length + summary.pendingSwaps.length).toBe(2);
  });

  it("counts a coverage gap for a day nobody opens", async () => {
    // No shifts at all, so every day of the week is a gap.
    const summary = await getAdminSummary(MONDAY, "week");
    expect(summary.gapDays).toBe(7);
    expect(summary.roster.dates).toHaveLength(7);
  });

  it("excludes task rows from headcount", async () => {
    // Two real people, so the assertion is about the task row and not about the
    // admin — who no longer pads the count either way.
    await createEmployee("emp-cleaning", "Cleaning", { sortOrder: 2 });
    expect((await getAdminSummary(MONDAY, "week")).headcount).toBe(2);

    await prisma.employee.update({
      where: { id: "emp-cleaning" },
      data: { isTaskRow: true },
    });

    expect((await getAdminSummary(MONDAY, "week")).headcount).toBe(1);
  });
});

describe("staff branch", () => {
  it("reports only that person's hours and pay", async () => {
    await createShift(STAFF, MONDAY, 9 * 60, 17 * 60);
    await createShift(ADMIN, MONDAY, 9 * 60, 17 * 60);

    const summary = await getStaffSummary(STAFF, MONDAY, "week");

    expect(summary?.kind).toBe("staff");
    expect(summary?.myHours).toBe(8);
    expect(summary?.myPay).toBe(8 * 130);
    expect(summary?.employee.id).toBe(STAFF);
  });

  it("surfaces the next shift within the visible week", async () => {
    await createShift(STAFF, SUNDAY, 10 * 60, 18 * 60);

    const summary = await getStaffSummary(STAFF, MONDAY, "week");

    expect(summary?.nextShift?.date).toBe(SUNDAY);
    expect(summary?.nextShift?.shift?.startMinutes).toBe(10 * 60);
  });

  it("returns null next shift for an empty week", async () => {
    const summary = await getStaffSummary(STAFF, MONDAY, "week");
    expect(summary?.nextShift).toBeNull();
    expect(summary?.myHours).toBe(0);
  });

  it("exposes the leave balance it displays", async () => {
    const summary = await getStaffSummary(STAFF, MONDAY, "week");
    expect(summary?.leaveBalance).toBe(14);
  });

  it("returns null for someone not on the roster", async () => {
    expect(await getStaffSummary("emp-ghost", MONDAY, "week")).toBeNull();
  });

  it("has seven cells in the week row", async () => {
    const summary = await getStaffSummary(STAFF, MONDAY, "week");
    expect(summary?.myRow?.cells).toHaveLength(7);
  });
});

describe("the two branches stay distinct", () => {
  it("gives the admin payroll and pending, and the staff neither", async () => {
    await createShift(STAFF, MONDAY);

    const admin = await getAdminSummary(MONDAY, "week");
    const staff = await getStaffSummary(STAFF, MONDAY, "week");

    expect(admin).toHaveProperty("payroll");
    expect(admin).toHaveProperty("pendingLeave");
    expect(staff).not.toHaveProperty("payroll");
    expect(staff).not.toHaveProperty("pendingLeave");
    // Both still describe the same week.
    expect(staff?.roster.weekStart).toBe(admin.roster.weekStart);
  });
});
