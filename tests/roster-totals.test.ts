/**
 * The grid view closes with a totals row: hours per day column, and the week's
 * total beside them. These are pure-function tests over the view model — the
 * project has no DOM harness, so what `RosterBoard` prints is verified through
 * the strings it is handed.
 */

import { describe, expect, it } from "vitest";

import { buildRosterTotals } from "@/components/features/timetable/view-model";
import type { ScheduleRow } from "@/lib/domain/schedule";
import { getDictionary } from "@/lib/i18n";
import type { Employee, IsoDate, Shift } from "@/types/domain";

const MONDAY = "2026-08-03";
const TUESDAY = "2026-08-04";
const WEDNESDAY = "2026-08-05";
const DATES: IsoDate[] = [MONDAY, TUESDAY, WEDNESDAY];

const dict = getDictionary("en");

function employee(id: string, overrides: Partial<Employee> = {}): Employee {
  return {
    id,
    firstName: "Ayse",
    lastName: "Test",
    position: { tr: "Barista", en: "Barista" },
    hourlyRate: 130,
    contract: "part",
    birthDate: null,
    hiredAt: null,
    leaveBalance: 10,
    phone: "",
    email: `${id}@b.c`,
    address: "",
    role: "staff",
    isTaskRow: false,
    archivedAt: null,
    ...overrides,
  };
}

function shift(employeeId: string, date: IsoDate, from: number, to: number): Shift {
  return {
    id: `${employeeId}-${date}`,
    employeeId,
    date,
    startMinutes: from * 60,
    endMinutes: to * 60,
  };
}

/** A row with a shift on each of the given days. */
function row(id: string, days: Partial<Record<IsoDate, [number, number]>>, isTaskRow = false): ScheduleRow {
  let hours = 0;
  const cells = DATES.map((date) => {
    const span = days[date];
    if (!span) return { date, shift: null, state: "off" as const };
    hours += span[1] - span[0];
    return { date, shift: shift(id, date, span[0], span[1]), state: "shift" as const };
  });

  return { employee: employee(id, { isTaskRow }), cells, hours };
}

describe("roster column totals", () => {
  it("sums every person scheduled on a day", () => {
    const totals = buildRosterTotals(
      [row("a", { [MONDAY]: [9, 17] }), row("b", { [MONDAY]: [7, 12] })],
      DATES,
      dict,
    );

    expect(totals.days[0].label).toBe("13h");
  });

  it("gives one entry per date, in column order", () => {
    const totals = buildRosterTotals([row("a", { [TUESDAY]: [9, 17] })], DATES, dict);
    expect(totals.days.map((day) => day.date)).toEqual(DATES);
  });

  it("prints a dash for a day nobody works, and says so in the label", () => {
    const totals = buildRosterTotals([row("a", { [MONDAY]: [9, 17] })], DATES, dict);
    const tuesday = totals.days[1];

    expect(tuesday.label).toBe("–");
    expect(tuesday.isEmpty).toBe(true);
    // The dash is a shape; a screen reader still gets the figure.
    expect(tuesday.ariaLabel).toContain("0h");
  });

  it("carries the day and the hours in the accessible name", () => {
    const totals = buildRosterTotals([row("a", { [MONDAY]: [9, 17] })], DATES, dict);
    expect(totals.days[0].ariaLabel).toBe(`${dict.timetable.total} · ${MONDAY} · 8h`);
  });

  it("keeps half hours", () => {
    const totals = buildRosterTotals([row("a", { [MONDAY]: [9, 17.5] })], DATES, dict);
    expect(totals.days[0].label).toBe("8.5h");
  });
});

describe("the week total", () => {
  it("is the sum of the rows' own hours", () => {
    const rows = [
      row("a", { [MONDAY]: [9, 17], [WEDNESDAY]: [9, 13] }),
      row("b", { [TUESDAY]: [7, 15] }),
    ];

    expect(buildRosterTotals(rows, DATES, dict).totalLabel).toBe("20h");
  });

  it("matches the sum of the columns", () => {
    const rows = [
      row("a", { [MONDAY]: [9, 17], [TUESDAY]: [10, 16] }),
      row("b", { [TUESDAY]: [7, 15], [WEDNESDAY]: [8, 12] }),
    ];
    const totals = buildRosterTotals(rows, DATES, dict);

    const columnSum = totals.days.reduce(
      (sum, day) => sum + Number(day.ariaLabel.split(" · ")[2].replace("h", "")),
      0,
    );
    expect(totals.totalLabel).toBe(`${columnSum}h`);
  });

  it("is zero-safe on an empty week", () => {
    const totals = buildRosterTotals([], DATES, dict);
    expect(totals.totalLabel).toBe("0h");
    expect(totals.days).toHaveLength(DATES.length);
  });
});

describe("task rows", () => {
  // A task carries no hours anyone is paid for — the same reason it is left out
  // of headcount and payroll.
  it("are left out of the column totals", () => {
    const rows = [row("a", { [MONDAY]: [9, 17] }), row("task", { [MONDAY]: [7, 19] }, true)];
    expect(buildRosterTotals(rows, DATES, dict).days[0].label).toBe("8h");
  });

  it("are left out of the week total", () => {
    const rows = [row("a", { [MONDAY]: [9, 17] }), row("task", { [MONDAY]: [7, 19] }, true)];
    expect(buildRosterTotals(rows, DATES, dict).totalLabel).toBe("8h");
  });
});

describe("the row header", () => {
  it("is localised, never a bare English word", () => {
    for (const locale of ["tr", "en"] as const) {
      const localised = getDictionary(locale);
      expect(buildRosterTotals([], DATES, localised).label).toBe(localised.timetable.total);
    }
  });

  it("uses the locale's hour suffix", () => {
    const rows = [row("a", { [MONDAY]: [9, 17] })];
    expect(buildRosterTotals(rows, DATES, getDictionary("tr")).totalLabel).toBe("8sa");
  });
});
