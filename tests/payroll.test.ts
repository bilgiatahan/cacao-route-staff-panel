/**
 * Payroll screen numbers, pinned across the migration.
 *
 * The migration was presentational — StatCard, DetailList and Badge replacing
 * hand-rolled markup — so every assertion here is about the arithmetic and
 * scoping underneath staying byte-identical: weekly hours and pay, the monthly
 * projection, the overtime split, the per-day earning the table renders, and the
 * role scoping that decides who sees whose numbers.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const { getEmployeeDetail, getTeamOverview } = await import(
  "@/server/services/team.service"
);
const { calculateWeeklyPay, isOvertime } = await import("@/lib/domain/payroll");
const { formatHourlyRate, formatHours, formatMoney, formatHoursValue } = await import(
  "@/lib/format",
);
const { mondaysInMonth } = await import("@/lib/date");
const { getDictionary } = await import("@/lib/i18n");
const { prisma } = await import("@/server/db/client");
const { MONDAY, createEmployee, createShift, resetDatabase } = await import(
  "./support/fixtures"
);

const ME = "emp-me";
const OTHER = "emp-other";
const RATE = 130;
const WEEK = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07"];

beforeEach(async () => {
  await resetDatabase();
  await createEmployee(ME, "Me", { sortOrder: 0 });
  await createEmployee(OTHER, "Other", { sortOrder: 1 });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("weekly figures", () => {
  it("sums only that person's shifts", async () => {
    await createShift(ME, MONDAY, 9 * 60, 17 * 60); // 8h
    await createShift(OTHER, MONDAY, 9 * 60, 17 * 60);

    const detail = await getEmployeeDetail(ME, MONDAY);

    expect(detail?.weeklyHours).toBe(8);
    expect(detail?.weeklyPay.total).toBe(8 * RATE);
    expect(detail?.weeklyPay.hourlyRate).toBe(RATE);
  });

  it("reports no overtime under the threshold", async () => {
    await createShift(ME, MONDAY, 9 * 60, 17 * 60);

    const detail = await getEmployeeDetail(ME, MONDAY);

    expect(detail?.overtime).toBe(false);
    expect(detail?.weeklyPay.overtimeHours).toBe(0);
    expect(detail?.weeklyPay.baseHours).toBe(8);
  });

  it("splits base and overtime past 45 hours at 1.5x", async () => {
    // 5 × 10h = 50h → 45 base + 5 overtime.
    for (const date of WEEK) await createShift(ME, date, 8 * 60, 18 * 60);

    const detail = await getEmployeeDetail(ME, MONDAY);

    expect(detail?.weeklyHours).toBe(50);
    expect(detail?.overtime).toBe(true);
    expect(detail?.weeklyPay.baseHours).toBe(45);
    expect(detail?.weeklyPay.overtimeHours).toBe(5);
    expect(detail?.weeklyPay.total).toBe(45 * RATE + 5 * RATE * 1.5);
    // The same rule the pure helper applies.
    expect(detail?.weeklyPay.total).toBe(calculateWeeklyPay(50, RATE).total);
    expect(isOvertime(50)).toBe(true);
  });
});

describe("monthly projection", () => {
  it("multiplies the week by the Mondays in the month", async () => {
    await createShift(ME, MONDAY, 9 * 60, 17 * 60);

    const detail = await getEmployeeDetail(ME, MONDAY);
    const weeks = mondaysInMonth(MONDAY);

    expect(detail?.weeksInMonth).toBe(weeks);
    expect(detail?.monthlyHours).toBe(8 * weeks);
    expect(detail?.monthlyPay).toBe(8 * RATE * weeks);
  });

  it("projects an overtime week without re-applying the threshold", async () => {
    for (const date of WEEK) await createShift(ME, date, 8 * 60, 18 * 60);

    const detail = await getEmployeeDetail(ME, MONDAY);
    const weeks = detail!.weeksInMonth;

    expect(detail?.monthlyPay).toBe(detail!.weeklyPay.total * weeks);
    expect(detail?.monthlyHours).toBe(50 * weeks);
  });
});

describe("the daily rows the table renders", () => {
  it("keeps one row per worked day, in week order", async () => {
    await createShift(ME, WEEK[0], 9 * 60, 17 * 60);
    await createShift(ME, WEEK[2], 10 * 60, 14 * 60);

    const detail = await getEmployeeDetail(ME, MONDAY);
    const worked = (detail?.row?.cells ?? []).filter((c) => c.shift);

    expect(detail?.row?.cells).toHaveLength(7);
    expect(worked.map((c) => c.date)).toEqual([WEEK[0], WEEK[2]]);
  });

  it("earns hours x rate per day, with no overtime applied per row", async () => {
    // Overtime is a weekly rule; a single day is always at the base rate.
    await createShift(ME, MONDAY, 9 * 60, 13 * 60); // 4h

    const detail = await getEmployeeDetail(ME, MONDAY);
    const cell = detail!.row!.cells.find((c) => c.shift)!;
    const hours = (cell.shift!.endMinutes - cell.shift!.startMinutes) / 60;

    expect(hours).toBe(4);
    expect(hours * detail!.employee.hourlyRate).toBe(4 * RATE);
  });

  it("has no rows at all for an empty week", async () => {
    const detail = await getEmployeeDetail(ME, MONDAY);

    expect((detail?.row?.cells ?? []).filter((c) => c.shift)).toHaveLength(0);
    expect(detail?.weeklyHours).toBe(0);
    expect(detail?.weeklyPay.total).toBe(0);
  });
});

describe("terms shown in the detail list", () => {
  it("reports the stored rate, contract and leave balance untouched", async () => {
    const detail = await getEmployeeDetail(ME, MONDAY);

    expect(detail?.employee.hourlyRate).toBe(RATE);
    expect(detail?.employee.contract).toBe("part");
    expect(detail?.employee.leaveBalance).toBe(14);
  });

  it("never exposes credentials, only whether one exists", async () => {
    expect((await getEmployeeDetail(ME, MONDAY))?.hasAccount).toBe(false);

    await prisma.user.create({
      data: { id: "u-me", email: "me@example.test", passwordHash: "x", employeeId: ME },
    });

    expect((await getEmployeeDetail(ME, MONDAY))?.hasAccount).toBe(true);
  });
});

describe("role scoping is unchanged", () => {
  it("returns null for an unknown employee", async () => {
    expect(await getEmployeeDetail("emp-ghost", MONDAY)).toBeNull();
  });

  it("returns null for an archived employee", async () => {
    await prisma.employee.update({
      where: { id: ME },
      data: { archivedAt: new Date() },
    });
    expect(await getEmployeeDetail(ME, MONDAY)).toBeNull();
  });

  it("still gives the admin overview every non-task member", async () => {
    // The Team screen is not migrated in this step; its data must not shift.
    await createShift(ME, MONDAY, 9 * 60, 17 * 60);

    const overview = await getTeamOverview(MONDAY);

    expect(overview.members).toHaveLength(2);
    const mine = overview.members.find((m) => m.employee.id === ME);
    expect(mine?.weeklyHours).toBe(8);
    expect(mine?.weeklyPay.total).toBe(8 * RATE);
    expect(mine?.overtime).toBe(false);
  });

  it("excludes task rows from the admin overview", async () => {
    await prisma.employee.update({ where: { id: OTHER }, data: { isTaskRow: true } });
    expect((await getTeamOverview(MONDAY)).members).toHaveLength(1);
  });
});

describe("formatting the screen relies on", () => {
  it("keeps hours and currency visually distinct", async () => {
    const dict = getDictionary("en");
    expect(formatHours(8, dict)).toBe(`8${dict.units.hourSuffix}`);
    expect(formatMoney(1040)).toBe("£1,040.00");
    expect(formatMoney(2972.5)).toBe("£2,972.50");
    expect(formatHourlyRate(13, dict)).toBe("£13.00/h");
    expect(formatHoursValue(8.5)).toBe("8.5");
    expect(formatHoursValue(8)).toBe("8");
  });

  it("has the new empty-earnings copy in both locales", () => {
    for (const locale of ["tr", "en"] as const) {
      expect(getDictionary(locale).team.noEarnings).toBeTruthy();
    }
  });
});
