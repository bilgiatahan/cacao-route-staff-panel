/**
 * Monthly cost — the service layer, against a real database.
 *
 * Thin by design: the arithmetic is pinned in `monthly-cost.test.ts` without a
 * database. What is left to prove here is the wiring, which is exactly the part
 * unit tests cannot see:
 *
 *   - the shift queries ask for the calendar month and its baseline, nothing wider
 *   - a shift on either side of the boundary is never fetched, so it cannot
 *     contribute even by accident
 *   - the roster is read once and shared by both months
 *   - the service returns precisely what the pure aggregator returns for the
 *     same three queries — no extra step hiding in between
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { getMonthlyCostReport } = await import("@/server/services/monthly-cost.service");
const { buildMonthlyCostReport, compareWithPreviousMonth } = await import(
  "@/lib/domain/monthly-cost"
);
const { employeeRepository } = await import("@/server/repositories/employee.repository");
const { shiftRepository } = await import("@/server/repositories/shift.repository");
const { prisma } = await import("@/server/db/client");
const { createEmployee, createShift, resetDatabase } = await import("./support/fixtures");

const AUGUST = "2026-08";
const MONTH_START = "2026-08-01";
const MONTH_END = "2026-08-31";
const JULY = "2026-07";
const PREV_START = "2026-07-01";
const PREV_END = "2026-07-31";

const STAFF_A = "emp-a";
const STAFF_B = "emp-b";
const ADMIN = "emp-admin";
const TASK = "emp-task";
const IDLE = "emp-idle";

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetDatabase();

  await createEmployee(STAFF_A, "Anna", { sortOrder: 0, hourlyRate: 100 });
  await createEmployee(STAFF_B, "Bruno", { sortOrder: 1, hourlyRate: 200 });
  await createEmployee(ADMIN, "Admin", { sortOrder: 2, role: "admin", hourlyRate: 500 });
  await createEmployee(TASK, "Cleaning", { sortOrder: 3, isTaskRow: true, hourlyRate: 999 });
  await createEmployee(IDLE, "Idle", { sortOrder: 4, hourlyRate: 100 });

  // 8h each unless stated. Inside August:
  //   A: 3, 4 Aug (16h, £1,600) and 31 Aug (8h, £800)  → £2,400
  //   B: 5 Aug, 4h                                      →   £800
  await createShift(STAFF_A, "2026-08-03");
  await createShift(STAFF_A, "2026-08-04");
  await createShift(STAFF_A, "2026-08-31");
  await createShift(STAFF_B, "2026-08-05", 9 * 60, 13 * 60);
  // Ineligible rows, inside the month.
  await createShift(ADMIN, "2026-08-03");
  await createShift(TASK, "2026-08-05", 6 * 60, 8 * 60);
  // Immediately outside the month, in weeks that August's report does list.
  await createShift(STAFF_A, "2026-07-31");
  await createShift(STAFF_B, "2026-07-27");
  await createShift(STAFF_A, "2026-09-01");
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("query shape", () => {
  it("asks for the month and its baseline, and nothing wider", async () => {
    const shifts = vi.spyOn(shiftRepository, "listByDateRange");
    const staff = vi.spyOn(employeeRepository, "listStaff");

    await getMonthlyCostReport(AUGUST);

    // Three queries total: one roster, one month, one baseline month.
    expect(shifts).toHaveBeenCalledTimes(2);
    expect(shifts).toHaveBeenCalledWith(MONTH_START, MONTH_END);
    expect(shifts).toHaveBeenCalledWith(PREV_START, PREV_END);
    // The roster is read once and reused for both months.
    expect(staff).toHaveBeenCalledTimes(1);
  });

  it("rolls the baseline back across a year boundary", async () => {
    const shifts = vi.spyOn(shiftRepository, "listByDateRange");

    await getMonthlyCostReport("2027-01");

    expect(shifts).toHaveBeenCalledWith("2027-01-01", "2027-01-31");
    expect(shifts).toHaveBeenCalledWith("2026-12-01", "2026-12-31");
  });

  it("asks for February's real extent, leap year included", async () => {
    const shifts = vi.spyOn(shiftRepository, "listByDateRange");

    await getMonthlyCostReport("2024-02");
    expect(shifts).toHaveBeenCalledWith("2024-02-01", "2024-02-29");

    await getMonthlyCostReport("2026-02");
    expect(shifts).toHaveBeenCalledWith("2026-02-01", "2026-02-28");
  });

  it("never reads leave, swaps or notifications", async () => {
    const leave = vi.spyOn(prisma.leaveRequest, "findMany");
    const swaps = vi.spyOn(prisma.swapRequest, "findMany");

    await getMonthlyCostReport(AUGUST);

    expect(leave).not.toHaveBeenCalled();
    expect(swaps).not.toHaveBeenCalled();
  });
});

describe("the report the service returns", () => {
  it("matches the pure aggregator over the same three queries", async () => {
    const [report, employees, shifts, previousShifts] = await Promise.all([
      getMonthlyCostReport(AUGUST),
      employeeRepository.listStaff(),
      shiftRepository.listByDateRange(MONTH_START, MONTH_END),
      shiftRepository.listByDateRange(PREV_START, PREV_END),
    ]);

    expect(report).toEqual(
      compareWithPreviousMonth(
        buildMonthlyCostReport(AUGUST, employees, shifts),
        buildMonthlyCostReport(JULY, employees, previousShifts),
      ),
    );
  });

  it("compares against July, whose only seeded shifts are 27 and 31 July", async () => {
    const report = await getMonthlyCostReport(AUGUST);
    const baseline = report.previousMonth;

    expect(baseline).not.toBeNull();
    expect(baseline?.month).toBe(JULY);
    // 27 July (Bruno, 8h × £200) + 31 July (Anna, 8h × £100) = 16h, £2,400.
    expect(baseline?.totals.hours).toBe(16);
    expect(baseline?.totals.cost).toBe(2400);
    expect(baseline?.activeStaffCount).toBe(2);
    // August 28h / £3,200 against July 16h / £2,400.
    expect(baseline?.hoursChange).toEqual({ absolute: 12, percent: 75 });
    expect(baseline?.costChange).toEqual({ absolute: 800, percent: expect.closeTo(100 / 3, 10) });
  });

  it("totals only the eligible shifts inside August", async () => {
    const report = await getMonthlyCostReport(AUGUST);

    // A 24h + B 4h. The admin's 8h, the task row's 2h and the three shifts
    // outside the month are all absent.
    expect(report.totals.hours).toBe(28);
    expect(report.totals.cost).toBe(3200);
    expect(report.totals.averageHourlyCost).toBeCloseTo(3200 / 28, 10);
  });

  it("keeps admins and task rows off the wage bill", async () => {
    const report = await getMonthlyCostReport(AUGUST);

    const ids = report.employees.map((line) => line.employeeId);
    expect(ids).not.toContain(ADMIN);
    expect(ids).not.toContain(TASK);
  });

  it("leaves out someone who worked no shifts", async () => {
    const report = await getMonthlyCostReport(AUGUST);

    expect(report.employees.map((line) => line.employeeId)).toEqual([STAFF_A, STAFF_B]);
    expect(report.activeStaffCount).toBe(2);
  });

  it("clips the boundary weeks to the month", async () => {
    const report = await getMonthlyCostReport(AUGUST);

    expect(report.weeksInMonth).toBe(6);

    // 27 Jul – 2 Aug: B's 27 July shift was never fetched, so the week is empty.
    const first = report.weeks[0];
    expect(first.weekStart).toBe("2026-07-27");
    expect(first.daysInMonth).toBe(2);
    expect(first.totals.hours).toBe(0);

    // 31 Aug – 6 Sep: A's 31 August shift counts, the 1 September one does not.
    const last = report.weeks[5];
    expect(last.weekStart).toBe("2026-08-31");
    expect(last.daysInMonth).toBe(1);
    expect(last.totals.hours).toBe(8);
    expect(last.totals.cost).toBe(800);
  });

  it("reads the rate off the employee row", async () => {
    const report = await getMonthlyCostReport(AUGUST);
    const [anna, bruno] = report.employees;

    expect(anna.hourlyRate).toBe(100);
    expect(anna.cost).toBe(2400);
    expect(bruno.hourlyRate).toBe(200);
    expect(bruno.cost).toBe(800);
  });

  it("follows a rate change, which is the documented v1 limitation", async () => {
    // Rate history is not stored, so restating the rate restates the past. This
    // pins the behaviour rather than endorsing it.
    const before = await getMonthlyCostReport(AUGUST);
    expect(before.totals.cost).toBe(3200);

    await employeeRepository.update(STAFF_A, { hourlyRate: 150 });

    const after = await getMonthlyCostReport(AUGUST);
    expect(after.totals.cost).toBe(24 * 150 + 4 * 200);
  });

  it("drops an archived employee, and their shifts with them", async () => {
    // `listStaff` filters archived rows, so the shifts they leave behind stop
    // contributing. Known and consistent with every other screen.
    await employeeRepository.archive(STAFF_B);

    const report = await getMonthlyCostReport(AUGUST);

    expect(report.employees.map((line) => line.employeeId)).toEqual([STAFF_A]);
    expect(report.totals.hours).toBe(24);
    expect(report.totals.cost).toBe(2400);
  });

  it("returns a valid empty report for a month with no shifts", async () => {
    const report = await getMonthlyCostReport("2026-05");

    expect(report.month).toBe("2026-05");
    expect(report.monthStart).toBe("2026-05-01");
    expect(report.monthEnd).toBe("2026-05-31");
    expect(report.totals).toEqual({ hours: 0, cost: 0, averageHourlyCost: null });
    expect(report.activeStaffCount).toBe(0);
    expect(report.employees).toEqual([]);
    expect(report.weeksWithData).toBe(0);
    expect(report.averageWeeklyCost).toBe(0);
  });
});

describe("existing services are untouched", () => {
  it("still projects the month the old way on the payroll report", async () => {
    // The projection and the actuals are different questions with different
    // answers; neither may start deriving from the other.
    const { getPayrollReport } = await import("@/server/services/payroll.service");
    const { mondaysInMonth } = await import("@/lib/date");

    const week = await getPayrollReport("2026-08-03", "week");
    const month = await getPayrollReport("2026-08-03", "month");

    expect(month.weeksInPeriod).toBe(mondaysInMonth("2026-08-03"));
    expect(month.totalHours).toBe(week.totalHours * month.weeksInPeriod);
  });
});
