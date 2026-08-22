/**
 * Monthly personnel cost — the pure arithmetic.
 *
 * Every case here runs against in-memory objects, no database, because the
 * things that go wrong in a calendar-month report are boundary and zero cases,
 * and those should be cheap to enumerate: a week straddling two months, a month
 * with no shifts at all, a percentage against a baseline of zero.
 *
 * Rates and shift lengths are chosen to be exactly representable in binary
 * (whole hours, whole rates), so the assertions can be exact rather than
 * approximate wherever the arithmetic allows it.
 */

import { describe, expect, it } from "vitest";

import {
  averageHourlyCost,
  buildMonthlyCostReport,
  compareWithPreviousMonth,
  delta,
  deltaOrNull,
  monthWeekRanges,
} from "@/lib/domain/monthly-cost";
import type { Employee, IsoDate, Shift } from "@/types/domain";

const AUGUST = "2026-08";

/** The six Monday–Sunday weeks touching August 2026. */
const AUG_WEEKS = [
  "2026-07-27",
  "2026-08-03",
  "2026-08-10",
  "2026-08-17",
  "2026-08-24",
  "2026-08-31",
];

function employee(id: string, overrides: Partial<Employee> = {}): Employee {
  return {
    id,
    firstName: id,
    lastName: "Test",
    position: { tr: "Barista", en: "Barista" },
    hourlyRate: 100,
    contract: "part",
    birthDate: null,
    hiredAt: null,
    leaveBalance: 0,
    phone: "",
    email: "",
    address: "",
    role: "staff",
    isTaskRow: false,
    archivedAt: null,
    ...overrides,
  };
}

/** Whole-hour shift, so `hours` is exact. */
function shift(employeeId: string, date: IsoDate, startHour = 9, endHour = 17): Shift {
  return {
    id: `shift-${employeeId}-${date}`,
    employeeId,
    date,
    startMinutes: startHour * 60,
    endMinutes: endHour * 60,
  };
}

/** Every number anywhere in the report, however deeply nested. */
function collectNumbers(value: unknown, found: number[] = []): number[] {
  if (typeof value === "number") found.push(value);
  else if (Array.isArray(value)) for (const item of value) collectNumbers(item, found);
  else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectNumbers(item, found);
  }
  return found;
}

/* ------------------------------------------------------------ week ranges -- */

describe("monthWeekRanges", () => {
  it("gives August 2026 six intersecting weeks", () => {
    const ranges = monthWeekRanges("2026-08-01", "2026-08-31");

    expect(ranges).toHaveLength(6);
    expect(ranges.map((range) => range.weekStart)).toEqual(AUG_WEEKS);
  });

  it("labels boundary weeks by their real Monday–Sunday span", () => {
    const ranges = monthWeekRanges("2026-08-01", "2026-08-31");

    // The leading week belongs to July but reads as itself.
    expect(ranges[0]).toEqual({
      weekStart: "2026-07-27",
      weekEnd: "2026-08-02",
      rangeStart: "2026-08-01",
      rangeEnd: "2026-08-02",
      daysInMonth: 2,
      isPartial: true,
    });

    // The trailing week runs into September and contributes a single day.
    expect(ranges[5]).toEqual({
      weekStart: "2026-08-31",
      weekEnd: "2026-09-06",
      rangeStart: "2026-08-31",
      rangeEnd: "2026-08-31",
      daysInMonth: 1,
      isPartial: true,
    });
  });

  it("leaves interior weeks whole", () => {
    const ranges = monthWeekRanges("2026-08-01", "2026-08-31");

    for (const range of ranges.slice(1, 5)) {
      expect(range.daysInMonth).toBe(7);
      expect(range.isPartial).toBe(false);
      expect(range.rangeStart).toBe(range.weekStart);
      expect(range.rangeEnd).toBe(range.weekEnd);
    }
  });

  it("covers every day of the month exactly once", () => {
    for (const [start, end, days] of [
      ["2026-08-01", "2026-08-31", 31],
      ["2026-02-01", "2026-02-28", 28],
      ["2024-02-01", "2024-02-29", 29],
      ["2026-12-01", "2026-12-31", 31],
    ] as const) {
      const covered = monthWeekRanges(start, end).reduce(
        (total, range) => total + range.daysInMonth,
        0,
      );
      expect(covered).toBe(days);
    }
  });

  it("has no partial week when the month starts on a Monday and ends on a Sunday", () => {
    // June 2026: 1 June is a Monday, 28 June a Sunday, so the last week spills.
    const ranges = monthWeekRanges("2026-06-01", "2026-06-30");

    expect(ranges[0].isPartial).toBe(false);
    expect(ranges[0].weekStart).toBe("2026-06-01");
    expect(ranges[ranges.length - 1].isPartial).toBe(true);
  });

  it("handles a leap February", () => {
    const ranges = monthWeekRanges("2024-02-01", "2024-02-29");

    expect(ranges[0].rangeStart).toBe("2024-02-01");
    expect(ranges[ranges.length - 1].rangeEnd).toBe("2024-02-29");
  });
});

/* ------------------------------------------------------------- primitives -- */

describe("averageHourlyCost", () => {
  it("divides cost by hours", () => {
    expect(averageHourlyCost(2800, 28)).toBe(100);
  });

  it("is null rather than Infinity when no hours were worked", () => {
    expect(averageHourlyCost(0, 0)).toBeNull();
    expect(averageHourlyCost(500, 0)).toBeNull();
  });
});

describe("delta", () => {
  it("reports a rise", () => {
    expect(delta(2400, 800)).toEqual({ absolute: 1600, percent: 200 });
  });

  it("reports a fall", () => {
    expect(delta(800, 1600)).toEqual({ absolute: -800, percent: -50 });
  });

  it("reports a drop to nothing as -100%", () => {
    expect(delta(0, 2400)).toEqual({ absolute: -2400, percent: -100 });
  });

  it("keeps the absolute difference but drops the percentage against a zero baseline", () => {
    expect(delta(1600, 0)).toEqual({ absolute: 1600, percent: null });
  });

  it("returns a zero difference and no percentage when both sides are zero", () => {
    expect(delta(0, 0)).toEqual({ absolute: 0, percent: null });
  });
});

/* -------------------------------------------------- month boundary clipping -- */

describe("month boundary", () => {
  const ME = "emp-me";
  const staff = [employee(ME)];

  it("counts only 1–2 August from the week of 27 July", () => {
    const report = buildMonthlyCostReport(AUGUST, staff, [
      // Outside the month — must not contribute, even though they belong to
      // the same Monday–Sunday week as the two days that do.
      shift(ME, "2026-07-27"),
      shift(ME, "2026-07-28"),
      shift(ME, "2026-07-29"),
      shift(ME, "2026-07-30"),
      shift(ME, "2026-07-31"),
      // Inside the month.
      shift(ME, "2026-08-01"),
      shift(ME, "2026-08-02"),
    ]);

    const first = report.weeks[0];

    expect(first.weekStart).toBe("2026-07-27");
    expect(first.weekEnd).toBe("2026-08-02");
    expect(first.daysInMonth).toBe(2);
    expect(first.totals.hours).toBe(16);
    expect(first.totals.cost).toBe(1600);
    expect(report.totals.hours).toBe(16);
  });

  it("counts only 31 August from the week of 31 August", () => {
    const report = buildMonthlyCostReport(AUGUST, staff, [
      shift(ME, "2026-08-31"),
      // September, same week — must not contribute.
      shift(ME, "2026-09-01"),
      shift(ME, "2026-09-02"),
      shift(ME, "2026-09-06"),
    ]);

    const last = report.weeks[5];

    expect(last.weekStart).toBe("2026-08-31");
    expect(last.weekEnd).toBe("2026-09-06");
    expect(last.daysInMonth).toBe(1);
    expect(last.totals.hours).toBe(8);
    expect(report.totals.hours).toBe(8);
  });

  it("drops shifts from other months entirely", () => {
    const report = buildMonthlyCostReport(AUGUST, staff, [
      shift(ME, "2026-06-15"),
      shift(ME, "2026-07-15"),
      shift(ME, "2026-09-15"),
      shift(ME, "2027-08-15"),
    ]);

    expect(report.totals.hours).toBe(0);
    expect(report.totals.cost).toBe(0);
    expect(report.activeStaffCount).toBe(0);
    expect(report.employees).toEqual([]);
  });

  it("reports the month's own extent", () => {
    const report = buildMonthlyCostReport(AUGUST, staff, []);

    expect(report.month).toBe("2026-08");
    expect(report.monthStart).toBe("2026-08-01");
    expect(report.monthEnd).toBe("2026-08-31");
    expect(report.weeksInMonth).toBe(6);
  });
});

/* ------------------------------------------------------------- eligibility -- */

describe("who is on the wage bill", () => {
  const STAFF = "emp-staff";
  const ADMIN = "emp-admin";
  const TASK = "emp-task";
  const IDLE = "emp-idle";

  const roster = [
    employee(STAFF, { hourlyRate: 100 }),
    employee(ADMIN, { role: "admin", hourlyRate: 500 }),
    employee(TASK, { isTaskRow: true, hourlyRate: 999 }),
    employee(IDLE, { hourlyRate: 100 }),
  ];

  it("excludes admins, however many shifts they hold", () => {
    const report = buildMonthlyCostReport(AUGUST, roster, [
      shift(STAFF, "2026-08-03"),
      shift(ADMIN, "2026-08-03"),
      shift(ADMIN, "2026-08-04"),
    ]);

    expect(report.employees.map((line) => line.employeeId)).toEqual([STAFF]);
    expect(report.activeStaffCount).toBe(1);
    expect(report.totals.hours).toBe(8);
    expect(report.totals.cost).toBe(800);
  });

  it("excludes task rows such as Cleaning", () => {
    const report = buildMonthlyCostReport(AUGUST, roster, [
      shift(STAFF, "2026-08-03"),
      shift(TASK, "2026-08-03", 6, 8),
    ]);

    expect(report.employees.map((line) => line.employeeId)).toEqual([STAFF]);
    expect(report.totals.hours).toBe(8);
    expect(report.totals.cost).toBe(800);
  });

  it("excludes an eligible person who worked no shifts", () => {
    const report = buildMonthlyCostReport(AUGUST, roster, [shift(STAFF, "2026-08-03")]);

    expect(report.activeStaffCount).toBe(1);
    expect(report.employees.map((line) => line.employeeId)).not.toContain(IDLE);
  });

  it("counts a person once however many shifts they worked", () => {
    const report = buildMonthlyCostReport(AUGUST, roster, [
      shift(STAFF, "2026-08-03"),
      shift(STAFF, "2026-08-04"),
      shift(STAFF, "2026-08-05"),
    ]);

    expect(report.activeStaffCount).toBe(1);
    expect(report.employees).toHaveLength(1);
    expect(report.employees[0].hours).toBe(24);
  });
});

/* ----------------------------------------------------------------- totals -- */

describe("month totals", () => {
  const A = "emp-a";
  const B = "emp-b";
  const C = "emp-c";

  const roster = [
    employee(A, { hourlyRate: 100, position: { tr: "Barista", en: "Barista" } }),
    employee(B, { hourlyRate: 200, position: { tr: "Vardiya Amiri", en: "Shift Lead" } }),
    employee(C, { hourlyRate: 50, position: { tr: "Kasiyer", en: "Cashier" } }),
  ];

  // A: 16h × £100 = £1600 · B: 4h × £200 = £800 · C: 8h × £50 = £400
  const shifts = [
    shift(A, "2026-08-03"),
    shift(A, "2026-08-04"),
    shift(B, "2026-08-05", 9, 13),
    shift(C, "2026-08-06"),
  ];

  const report = buildMonthlyCostReport(AUGUST, roster, shifts);

  it("sums the hours actually worked", () => {
    expect(report.totals.hours).toBe(28);
  });

  it("sums hours × rate per person, with no overtime rule", () => {
    expect(report.totals.cost).toBe(2800);
  });

  it("reports the blended hourly cost", () => {
    expect(report.totals.averageHourlyCost).toBe(100);
  });

  it("counts everyone who worked", () => {
    expect(report.activeStaffCount).toBe(3);
  });

  it("gives one employee line per person, cost descending", () => {
    expect(report.employees.map((line) => [line.employeeId, line.cost])).toEqual([
      [A, 1600],
      [B, 800],
      [C, 400],
    ]);
  });

  it("carries the person's hours and rate", () => {
    const [first, second, third] = report.employees;

    expect(first.hours).toBe(16);
    expect(first.hourlyRate).toBe(100);
    expect(second.hours).toBe(4);
    expect(second.hourlyRate).toBe(200);
    expect(third.hours).toBe(8);
    expect(third.hourlyRate).toBe(50);
  });

  it("carries the name and the untranslated position", () => {
    const line = report.employees[1];

    expect(line.name).toBe("emp-b Test");
    // A `Localized`, not a formatted string — the view picks the locale.
    expect(line.position).toEqual({ tr: "Vardiya Amiri", en: "Shift Lead" });
  });

  it("shares the cost out in percentages", () => {
    const [first, second, third] = report.employees;

    expect(first.shareOfCost).toBeCloseTo((1600 / 2800) * 100, 10);
    expect(second.shareOfCost).toBeCloseTo((800 / 2800) * 100, 10);
    expect(third.shareOfCost).toBeCloseTo((400 / 2800) * 100, 10);
  });

  it("has shares that sum to 100", () => {
    const total = report.employees.reduce((sum, line) => sum + (line.shareOfCost ?? 0), 0);
    expect(total).toBeCloseTo(100, 10);
  });

  it("agrees between the headline, the weekly column and the employee column", () => {
    const byWeek = report.weeks.reduce((sum, week) => sum + week.totals.cost, 0);
    const byEmployee = report.employees.reduce((sum, line) => sum + line.cost, 0);

    expect(byWeek).toBe(report.totals.cost);
    expect(byEmployee).toBeCloseTo(report.totals.cost, 10);
  });

  it("keeps a person earning nothing in the list with a zero share", () => {
    const unpaid = buildMonthlyCostReport(
      AUGUST,
      [employee("emp-free", { hourlyRate: 0 })],
      [shift("emp-free", "2026-08-03")],
    );

    expect(unpaid.employees).toHaveLength(1);
    expect(unpaid.employees[0].hours).toBe(8);
    expect(unpaid.employees[0].cost).toBe(0);
    // Total cost is 0, so no share is definable.
    expect(unpaid.employees[0].shareOfCost).toBeNull();
    expect(unpaid.totals.averageHourlyCost).toBe(0);
  });

  it("keeps roster order between people who cost the same", () => {
    const tied = buildMonthlyCostReport(
      AUGUST,
      [employee("emp-first"), employee("emp-second")],
      [shift("emp-first", "2026-08-03"), shift("emp-second", "2026-08-04")],
    );

    expect(tied.employees.map((line) => line.employeeId)).toEqual([
      "emp-first",
      "emp-second",
    ]);
  });
});

/* -------------------------------------------------------- weekly breakdown -- */

describe("weekly breakdown and week-over-week change", () => {
  const ME = "emp-me";
  const staff = [employee(ME, { hourlyRate: 100 })];

  // Nothing in the 27 Jul week, so the second week's baseline is zero.
  //   W1 27 Jul  →     0h  ·      £0
  //   W2  3 Aug  →    16h  ·  £1,600
  //   W3 10 Aug  →     8h  ·    £800
  //   W4 17 Aug  →    24h  ·  £2,400
  //   W5 24 Aug  →     0h  ·      £0
  //   W6 31 Aug  →     0h  ·      £0
  const report = buildMonthlyCostReport(AUGUST, staff, [
    shift(ME, "2026-08-03"),
    shift(ME, "2026-08-04"),
    shift(ME, "2026-08-10"),
    shift(ME, "2026-08-17"),
    shift(ME, "2026-08-18"),
    shift(ME, "2026-08-19"),
  ]);

  it("emits one line per intersecting week, in order", () => {
    expect(report.weeks).toHaveLength(6);
    expect(report.weeks.map((week) => week.weekStart)).toEqual(AUG_WEEKS);
  });

  it("buckets each shift into the week of its own Monday", () => {
    expect(report.weeks.map((week) => week.totals.hours)).toEqual([0, 16, 8, 24, 0, 0]);
    expect(report.weeks.map((week) => week.totals.cost)).toEqual([0, 1600, 800, 2400, 0, 0]);
  });

  it("gives the first week no comparison at all", () => {
    expect(report.weeks[0].costChange).toBeNull();
    expect(report.weeks[0].hoursChange).toBeNull();
  });

  it("keeps the absolute change but no percentage when the previous week was empty", () => {
    expect(report.weeks[1].costChange).toEqual({ absolute: 1600, percent: null });
    expect(report.weeks[1].hoursChange).toEqual({ absolute: 16, percent: null });
  });

  it("reports a fall against a real baseline", () => {
    expect(report.weeks[2].costChange).toEqual({ absolute: -800, percent: -50 });
    expect(report.weeks[2].hoursChange).toEqual({ absolute: -8, percent: -50 });
  });

  it("reports a rise against a real baseline", () => {
    expect(report.weeks[3].costChange).toEqual({ absolute: 1600, percent: 200 });
    expect(report.weeks[3].hoursChange).toEqual({ absolute: 16, percent: 200 });
  });

  it("reports a drop to nothing as -100%", () => {
    expect(report.weeks[4].costChange).toEqual({ absolute: -2400, percent: -100 });
  });

  it("reports no change and no percentage between two empty weeks", () => {
    expect(report.weeks[5].costChange).toEqual({ absolute: 0, percent: null });
    expect(report.weeks[5].hoursChange).toEqual({ absolute: 0, percent: null });
  });

  it("carries partial-week metadata on both boundary weeks", () => {
    expect(report.weeks.map((week) => week.isPartial)).toEqual([
      true,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(report.weeks.map((week) => week.daysInMonth)).toEqual([2, 7, 7, 7, 7, 1]);
  });

  it("gives a week with no hours no hourly cost rather than zero", () => {
    expect(report.weeks[0].totals.averageHourlyCost).toBeNull();
    expect(report.weeks[1].totals.averageHourlyCost).toBe(100);
  });
});

/* ------------------------------------------------------- weekly averages -- */

describe("weekly averages", () => {
  const ME = "emp-me";
  const staff = [employee(ME, { hourlyRate: 100 })];

  it("divides by the weeks that carried data, partial weeks included", () => {
    // Three weeks with shifts out of the six touching August: the leading
    // partial week (1–2 Aug) is one of them and counts as it is.
    const report = buildMonthlyCostReport(AUGUST, staff, [
      shift(ME, "2026-08-01"), // W1, partial
      shift(ME, "2026-08-03"), // W2
      shift(ME, "2026-08-10"), // W3
    ]);

    expect(report.weeksInMonth).toBe(6);
    expect(report.weeksWithData).toBe(3);
    expect(report.totals.hours).toBe(24);
    expect(report.totals.cost).toBe(2400);
    expect(report.averageWeeklyHours).toBe(8);
    expect(report.averageWeeklyCost).toBe(800);
  });

  it("keeps average × weeksWithData equal to the total", () => {
    const report = buildMonthlyCostReport(AUGUST, staff, [
      shift(ME, "2026-08-01"),
      shift(ME, "2026-08-03"),
      shift(ME, "2026-08-04"),
      shift(ME, "2026-08-31"),
    ]);

    expect(report.averageWeeklyCost * report.weeksWithData).toBeCloseTo(
      report.totals.cost,
      10,
    );
    expect(report.averageWeeklyHours * report.weeksWithData).toBeCloseTo(
      report.totals.hours,
      10,
    );
  });

  it("counts a week as having data even when its shifts earned nothing", () => {
    const report = buildMonthlyCostReport(
      AUGUST,
      [employee("emp-free", { hourlyRate: 0 })],
      [shift("emp-free", "2026-08-03")],
    );

    expect(report.weeksWithData).toBe(1);
    expect(report.averageWeeklyHours).toBe(8);
    expect(report.averageWeeklyCost).toBe(0);
  });
});

/* ------------------------------------------------------------ empty month -- */

describe("an empty month is still a valid report", () => {
  const report = buildMonthlyCostReport(AUGUST, [employee("emp-me")], []);

  it("reports zero totals and no hourly cost", () => {
    expect(report.totals).toEqual({ hours: 0, cost: 0, averageHourlyCost: null });
  });

  it("has nobody active and no employee lines", () => {
    expect(report.activeStaffCount).toBe(0);
    expect(report.employees).toEqual([]);
  });

  it("still lists every week of the month", () => {
    expect(report.weeksInMonth).toBe(6);
    expect(report.weeks).toHaveLength(6);
    expect(report.weeksWithData).toBe(0);
  });

  it("averages to zero rather than to nothing", () => {
    // These are plain numbers in the model: £0 a week is a true statement about
    // a month in which nothing was spent.
    expect(report.averageWeeklyCost).toBe(0);
    expect(report.averageWeeklyHours).toBe(0);
  });

  it("compares empty weeks without inventing a percentage", () => {
    expect(report.weeks[0].costChange).toBeNull();
    for (const week of report.weeks.slice(1)) {
      expect(week.costChange).toEqual({ absolute: 0, percent: null });
      expect(week.hoursChange).toEqual({ absolute: 0, percent: null });
    }
  });

  it("holds no roster at all without failing", () => {
    const nobody = buildMonthlyCostReport(AUGUST, [], []);

    expect(nobody.totals.cost).toBe(0);
    expect(nobody.activeStaffCount).toBe(0);
    expect(nobody.weeksInMonth).toBe(6);
  });
});

/* ------------------------------------------------------ numeric soundness -- */

describe("no number in the report is NaN or Infinity", () => {
  const cases: Array<[string, ReturnType<typeof buildMonthlyCostReport>]> = [
    ["empty month", buildMonthlyCostReport(AUGUST, [employee("emp-a")], [])],
    ["no roster", buildMonthlyCostReport(AUGUST, [], [])],
    [
      "zero-rate employee",
      buildMonthlyCostReport(
        AUGUST,
        [employee("emp-a", { hourlyRate: 0 })],
        [shift("emp-a", "2026-08-03")],
      ),
    ],
    [
      "only boundary days",
      buildMonthlyCostReport(
        AUGUST,
        [employee("emp-a")],
        [shift("emp-a", "2026-08-01"), shift("emp-a", "2026-08-31")],
      ),
    ],
    [
      "a shift of no length",
      buildMonthlyCostReport(
        AUGUST,
        [employee("emp-a")],
        [shift("emp-a", "2026-08-03", 9, 9)],
      ),
    ],
    [
      "awkward fractional hours",
      buildMonthlyCostReport(
        AUGUST,
        [employee("emp-a", { hourlyRate: 13.37 })],
        [
          { ...shift("emp-a", "2026-08-03"), startMinutes: 505, endMinutes: 1055 },
          { ...shift("emp-a", "2026-08-04"), startMinutes: 437, endMinutes: 869 },
        ],
      ),
    ],
  ];

  for (const [label, report] of cases) {
    it(`stays finite for: ${label}`, () => {
      const numbers = collectNumbers(report);

      expect(numbers.length).toBeGreaterThan(0);
      for (const value of numbers) {
        expect(Number.isFinite(value)).toBe(true);
      }
    });
  }
});

/* ------------------------------------------------------- historical rates -- */

describe("the hourly-rate seam", () => {
  const ME = "emp-me";
  const staff = [employee(ME, { hourlyRate: 100 })];
  const shifts = [shift(ME, "2026-08-03"), shift(ME, "2026-08-24")];

  it("uses the employee's current rate by default", () => {
    // The documented v1 limitation: rate history is not stored, so a historical
    // month is priced at today's rate.
    const report = buildMonthlyCostReport(AUGUST, staff, shifts);

    expect(report.totals.cost).toBe(1600);
    expect(report.employees[0].hourlyRate).toBe(100);
  });

  it("prices each shift on its own date when given a date-aware resolver", () => {
    // Proves the seam: an effective-dated rate table can be dropped in behind
    // this signature without the report model changing shape.
    const report = buildMonthlyCostReport(AUGUST, staff, shifts, (_employeeId, date) =>
      date < "2026-08-15" ? 100 : 200,
    );

    // 8h at £100 in the first half, 8h at £200 in the second.
    expect(report.totals.cost).toBe(2400);
    expect(report.weeks[1].totals.cost).toBe(800);
    expect(report.weeks[4].totals.cost).toBe(1600);
    // The line's headline rate is the one in effect at month end.
    expect(report.employees[0].hourlyRate).toBe(200);
    // Hours are untouched by any rate question.
    expect(report.totals.hours).toBe(16);
    expect(report.totals.averageHourlyCost).toBe(150);
  });
});

/* -------------------------------------------------- coverage and headcount -- */

describe("coverage gaps", () => {
  const A = "emp-a";
  const B = "emp-b";
  const roster = [employee(A), employee(B)];

  /** Opening 07:00 (60min grace) to closing 19:00 — a fully covered day. */
  const covered = (id: string, date: IsoDate) => shift(id, date, 7, 19);

  it("counts a day nobody is scheduled as a gap", () => {
    const report = buildMonthlyCostReport(AUGUST, roster, [covered(A, "2026-08-03")]);

    // Only 3 August is covered, so the other 30 days of August are all gaps.
    expect(report.gapDays).toBe(30);
    expect(report.weeks[1].gapDays).toBe(6);
  });

  it("judges a boundary week only on its in-month days", () => {
    // The 27 July week contributes 1–2 August. Covering both leaves it gapless,
    // even though 27–31 July are empty.
    const report = buildMonthlyCostReport(AUGUST, roster, [
      covered(A, "2026-08-01"),
      covered(A, "2026-08-02"),
    ]);

    expect(report.weeks[0].daysInMonth).toBe(2);
    expect(report.weeks[0].gapDays).toBe(0);
  });

  it("counts the single-day trailing week as at most one gap", () => {
    const report = buildMonthlyCostReport(AUGUST, roster, []);

    expect(report.weeks[5].daysInMonth).toBe(1);
    expect(report.weeks[5].gapDays).toBe(1);
  });

  it("flags a late opening and an early close", () => {
    const report = buildMonthlyCostReport(AUGUST, roster, [
      shift(A, "2026-08-03", 9, 19), // opens 09:00 — past the 08:00 grace
      shift(A, "2026-08-04", 7, 17), // closes 17:00 — before 19:00
      covered(A, "2026-08-05"),
    ]);

    expect(report.weeks[1].gapDays).toBe(6);
    expect(report.gapDays).toBe(30);
  });

  it("sums to the month total across every week", () => {
    const report = buildMonthlyCostReport(AUGUST, roster, [covered(A, "2026-08-10")]);

    expect(report.weeks.reduce((sum, week) => sum + week.gapDays, 0)).toBe(report.gapDays);
    // 31 days in August, one of them covered.
    expect(report.gapDays).toBe(30);
  });

  it("ignores an admin's shift when judging cover", () => {
    // Coverage is assessed over cost-bearing shifts only, the same basis as pay.
    const withAdmin = buildMonthlyCostReport(
      AUGUST,
      [employee(A), employee("emp-boss", { role: "admin" })],
      [covered("emp-boss", "2026-08-03")],
    );

    expect(withAdmin.weeks[1].gapDays).toBe(7);
  });
});

describe("weekly headcount", () => {
  const A = "emp-a";
  const B = "emp-b";
  const C = "emp-c";
  const roster = [employee(A), employee(B), employee(C)];

  it("counts a person once however many days they worked", () => {
    const report = buildMonthlyCostReport(AUGUST, roster, [
      shift(A, "2026-08-03"),
      shift(A, "2026-08-04"),
      shift(A, "2026-08-05"),
      shift(B, "2026-08-05"),
    ]);

    expect(report.weeks[1].activeStaffCount).toBe(2);
  });

  it("counts each week separately", () => {
    const report = buildMonthlyCostReport(AUGUST, roster, [
      shift(A, "2026-08-03"),
      shift(B, "2026-08-04"),
      shift(C, "2026-08-05"),
      shift(A, "2026-08-10"),
    ]);

    expect(report.weeks.map((week) => week.activeStaffCount)).toEqual([0, 3, 1, 0, 0, 0]);
  });

  it("averages over the weeks that carried data", () => {
    const report = buildMonthlyCostReport(AUGUST, roster, [
      shift(A, "2026-08-03"),
      shift(B, "2026-08-04"),
      shift(C, "2026-08-05"), // week 2 → 3 people
      shift(A, "2026-08-10"), // week 3 → 1 person
    ]);

    expect(report.weeksWithData).toBe(2);
    expect(report.averageWeeklyStaffCount).toBe(2);
  });

  it("averages to zero for an empty month rather than dividing by nothing", () => {
    const report = buildMonthlyCostReport(AUGUST, roster, []);

    expect(report.averageWeeklyStaffCount).toBe(0);
    expect(Number.isFinite(report.averageWeeklyStaffCount)).toBe(true);
  });

  it("never exceeds the month's own active staff count", () => {
    const report = buildMonthlyCostReport(AUGUST, roster, [
      shift(A, "2026-08-03"),
      shift(B, "2026-08-10"),
    ]);

    for (const week of report.weeks) {
      expect(week.activeStaffCount).toBeLessThanOrEqual(report.activeStaffCount);
    }
  });
});

/* --------------------------------------------------- previous-month compare -- */

describe("deltaOrNull", () => {
  it("compares two real figures", () => {
    expect(deltaOrNull(12, 10)).toEqual({ absolute: 2, percent: 20 });
  });

  it("refuses to compare against a quantity that did not exist", () => {
    expect(deltaOrNull(12, null)).toBeNull();
    expect(deltaOrNull(null, 10)).toBeNull();
    expect(deltaOrNull(null, null)).toBeNull();
  });
});

describe("compareWithPreviousMonth", () => {
  const ME = "emp-me";
  const staff = [employee(ME, { hourlyRate: 10 })];

  // August: 16h at £10 = £160. July: 8h at £10 = £80.
  const august = buildMonthlyCostReport(AUGUST, staff, [
    shift(ME, "2026-08-03"),
    shift(ME, "2026-08-04"),
  ]);
  const july = buildMonthlyCostReport("2026-07", staff, [shift(ME, "2026-07-06")]);

  it("leaves the report without a baseline until one is attached", () => {
    expect(august.previousMonth).toBeNull();
  });

  it("carries the baseline month's own figures", () => {
    const compared = compareWithPreviousMonth(august, july);

    expect(compared.previousMonth?.month).toBe("2026-07");
    expect(compared.previousMonth?.totals.hours).toBe(8);
    expect(compared.previousMonth?.totals.cost).toBe(80);
    expect(compared.previousMonth?.activeStaffCount).toBe(1);
  });

  it("reports the change in cost, hours and rate", () => {
    const compared = compareWithPreviousMonth(august, july);

    expect(compared.previousMonth?.costChange).toEqual({ absolute: 80, percent: 100 });
    expect(compared.previousMonth?.hoursChange).toEqual({ absolute: 8, percent: 100 });
    // Same rate both months, so the blended figure did not move.
    expect(compared.previousMonth?.averageHourlyCostChange).toEqual({
      absolute: 0,
      percent: 0,
    });
  });

  it("compares coverage and headcount too", () => {
    const compared = compareWithPreviousMonth(august, july);

    expect(compared.previousMonth?.gapDaysChange.absolute).toBe(
      august.gapDays - july.gapDays,
    );
    expect(compared.previousMonth?.activeStaffCountChange).toEqual({
      absolute: 0,
      percent: 0,
    });
  });

  it("does not compare an hourly rate that one month never had", () => {
    const empty = buildMonthlyCostReport("2026-07", staff, []);
    const compared = compareWithPreviousMonth(august, empty);

    expect(empty.totals.averageHourlyCost).toBeNull();
    expect(compared.previousMonth?.averageHourlyCostChange).toBeNull();
    // The absolute cost change is still perfectly well defined.
    expect(compared.previousMonth?.costChange).toEqual({ absolute: 160, percent: null });
  });

  it("leaves the current month's own figures untouched", () => {
    const compared = compareWithPreviousMonth(august, july);

    expect(compared.totals).toEqual(august.totals);
    expect(compared.weeks).toEqual(august.weeks);
    expect(compared.employees).toEqual(august.employees);
    // Non-mutating: the inputs are unchanged.
    expect(august.previousMonth).toBeNull();
    expect(july.previousMonth).toBeNull();
  });

  it("stays finite when both months are empty", () => {
    const a = buildMonthlyCostReport(AUGUST, staff, []);
    const b = buildMonthlyCostReport("2026-07", staff, []);
    const compared = compareWithPreviousMonth(a, b);

    for (const value of collectNumbers(compared)) {
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(compared.previousMonth?.costChange).toEqual({ absolute: 0, percent: null });
  });
});
