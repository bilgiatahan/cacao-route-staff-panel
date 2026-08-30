/**
 * Payroll screen numbers, pinned across the migration.
 *
 * The migration was presentational — StatCard, DetailList and Badge replacing
 * hand-rolled markup — so every assertion here is about the arithmetic and
 * scoping underneath staying byte-identical: weekly hours and pay, the per-day
 * earning the table renders, and the role scoping that decides who sees whose
 * numbers.
 *
 * The month is the one figure that deliberately did *not* stay identical. It was
 * `weeklyHours * mondaysInMonth` — a forecast of the displayed week — and became
 * the actual shifts worked in the selected month once the screen gained a month
 * switcher. The block below pins the new rule and the boundary behaviour it
 * shares with `/reports`.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const { getEmployeeDetail, getTeamOverview } = await import(
  "@/server/services/team.service"
);
const { calculateWeeklyPay } = await import("@/lib/domain/payroll");
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

  it("pays every hour at the base rate, however long the week", async () => {
    // 5 × 10h = 50h — no threshold, no multiplier.
    for (const date of WEEK) await createShift(ME, date, 8 * 60, 18 * 60);

    const detail = await getEmployeeDetail(ME, MONDAY);

    expect(detail?.weeklyHours).toBe(50);
    expect(detail?.weeklyPay.total).toBe(50 * RATE);
    // The same rule the pure helper applies.
    expect(detail?.weeklyPay.total).toBe(calculateWeeklyPay(50, RATE).total);
  });
});

describe("the month, over the shifts actually worked", () => {
  it("is no longer the week multiplied by the Mondays in the month", async () => {
    await createShift(ME, MONDAY, 9 * 60, 17 * 60);

    const detail = await getEmployeeDetail(ME, MONDAY);

    // The old figure was 8h x 5 Mondays = 40h for a single worked day.
    expect(mondaysInMonth(MONDAY)).toBe(5);
    expect(detail?.month.hours).toBe(8);
    expect(detail?.month.pay).toBe(8 * RATE);
  });

  it("counts only shifts inside the month", async () => {
    await createShift(ME, "2026-07-31", 9 * 60, 17 * 60); // previous month
    await createShift(ME, "2026-08-01", 9 * 60, 17 * 60); // in month, boundary week
    await createShift(ME, "2026-09-01", 9 * 60, 17 * 60); // next month

    const detail = await getEmployeeDetail(ME, MONDAY);

    expect(detail?.month.month).toBe("2026-08");
    expect(detail?.month.hours).toBe(8);
  });

  it("splits a boundary week at the month edge", async () => {
    // The week of 27 Jul – 2 Aug touches August by two days only.
    await createShift(ME, "2026-07-30", 9 * 60, 17 * 60);
    await createShift(ME, "2026-08-01", 9 * 60, 17 * 60);

    const first = (await getEmployeeDetail(ME, MONDAY))!.month.weeks[0];

    expect(first.weekStart).toBe("2026-07-27");
    expect(first.rangeStart).toBe("2026-08-01");
    expect(first.rangeEnd).toBe("2026-08-02");
    expect(first.isPartial).toBe(true);
    // The 30 July shift is in the same week and not in the month.
    expect(first.hours).toBe(8);
  });

  it("buckets each shift into the week that contains it", async () => {
    await createShift(ME, "2026-08-04", 9 * 60, 17 * 60); // week of 3 Aug, 8h
    await createShift(ME, "2026-08-12", 9 * 60, 15 * 60); // week of 10 Aug, 6h

    const detail = await getEmployeeDetail(ME, MONDAY);
    const hoursByWeek = new Map(detail!.month.weeks.map((w) => [w.weekStart, w.hours]));

    expect(hoursByWeek.get("2026-08-03")).toBe(8);
    expect(hoursByWeek.get("2026-08-10")).toBe(6);
    expect(hoursByWeek.get("2026-08-17")).toBe(0);
  });

  it("totals exactly what its own weeks add up to", async () => {
    for (const date of WEEK) await createShift(ME, date, 8 * 60, 18 * 60); // 5 x 10h

    const detail = await getEmployeeDetail(ME, MONDAY);
    const summed = detail!.month.weeks.reduce((total, week) => total + week.hours, 0);

    expect(detail?.month.hours).toBe(summed);
    expect(detail?.month.pay).toBe(summed * RATE);
    expect(detail?.month.weeksWorked).toBe(1);
  });

  it("lists every week touching the month, worked or not", async () => {
    const detail = await getEmployeeDetail(ME, MONDAY);

    // 1 Aug 2026 is a Saturday and 31 Aug a Monday, so six weeks touch it —
    // one more than the five Mondays the old projection counted.
    expect(detail?.month.weeks).toHaveLength(6);
    expect(detail?.month.weeksWorked).toBe(0);
    expect(detail?.month.hours).toBe(0);
  });

  it("reads a month the displayed week is not in", async () => {
    await createShift(ME, "2026-08-04", 9 * 60, 17 * 60); // 8h in August
    await createShift(ME, "2026-07-15", 9 * 60, 13 * 60); // 4h in July

    const august = await getEmployeeDetail(ME, MONDAY);
    const july = await getEmployeeDetail(ME, MONDAY, "2026-07");

    expect(august?.month.hours).toBe(8);
    expect(july?.month.month).toBe("2026-07");
    expect(july?.month.hours).toBe(4);
    // Only the month moved: the week is the same one either way.
    expect(july?.weeklyHours).toBe(8);
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

  it("earns hours x rate per day", async () => {
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

  it("has the empty-earnings copy in both locales, per period", () => {
    // The month needs its own sentence: "no shifts worked this week" under a
    // heading that says "this month" is the kind of wrong that survives review.
    for (const locale of ["tr", "en"] as const) {
      const { team } = getDictionary(locale);
      expect(team.noEarnings).toBeTruthy();
      expect(team.noMonthEarnings).toBeTruthy();
      expect(team.noMonthEarnings).not.toBe(team.noEarnings);
      expect(team.myMonthlyEarnings).not.toBe(team.myWeeklyEarnings);
    }
  });
});
