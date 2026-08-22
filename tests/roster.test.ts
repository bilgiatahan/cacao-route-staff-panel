/**
 * Schedule / Roster: URL-driven state and week navigation.
 *
 * The migration was presentational plus mounting week navigation, so these pin
 * the semantics that navigation depends on: what a week resolves to, what
 * stepping a week produces, that the view and day survive the step, and that the
 * roster data behind all three views is untouched.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const { getRosterWeek } = await import("@/server/services/roster.service");
const { buildDayColumns, buildDayRows, buildRosterRows, buildHourTicks } = await import(
  "@/components/features/timetable/view-model"
);
const { resolveWeekStart, resolveRosterView, resolveDayIndex } = await import(
  "@/lib/week-params"
);
const { addIsoDays, startOfWeekIso, weekDates, weekdayIndex } = await import("@/lib/date");
const { formatWeekLabel } = await import("@/lib/format");
const { panelHref, ROUTES } = await import("@/lib/routes");
const { getDictionary } = await import("@/lib/i18n");
const { prisma } = await import("@/server/db/client");
const { MONDAY, createEmployee, createShift, resetDatabase } = await import(
  "./support/fixtures"
);

const NEXT_MONDAY = "2026-08-10";
const PREV_MONDAY = "2026-07-27";
const STAFF = "emp-staff";
const TASK = "emp-task";

/** The page's own week-stepping expression. */
function weekHref(weekStart: string, offset: number, view: string, dayIndex: number) {
  return panelHref(ROUTES.timetable, {
    week: addIsoDays(weekStart, offset * 7),
    view,
    day: view === "day" ? String(dayIndex) : undefined,
  });
}

beforeEach(async () => {
  await resetDatabase();
  await createEmployee(STAFF, "Staff", { sortOrder: 0 });
  await createEmployee(TASK, "Cleaning", { sortOrder: 1 });
  await prisma.employee.update({ where: { id: TASK }, data: { isTaskRow: true } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("week resolution is unchanged", () => {
  it("snaps any date in a week to its Monday", () => {
    expect(resolveWeekStart("2026-08-06")).toBe(MONDAY);
    expect(resolveWeekStart("2026-08-09")).toBe(MONDAY); // Sunday
    expect(resolveWeekStart(MONDAY)).toBe(MONDAY);
  });

  it("falls back to the current week for junk or nothing", () => {
    expect(resolveWeekStart("not-a-date")).toBe(startOfWeekIso(resolveWeekStart(undefined)));
    expect(resolveWeekStart(undefined)).toBe(resolveWeekStart(undefined));
  });

  it("covers exactly seven days, Monday to Sunday", () => {
    const dates = weekDates(MONDAY);
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe(MONDAY);
    expect(dates[6]).toBe("2026-08-09");
    expect(weekdayIndex(dates[6])).toBe(6);
  });
});

describe("previous / next week navigation", () => {
  it("steps exactly one week in each direction", () => {
    expect(addIsoDays(MONDAY, 7)).toBe(NEXT_MONDAY);
    expect(addIsoDays(MONDAY, -7)).toBe(PREV_MONDAY);
  });

  it("keeps the current view when stepping", () => {
    expect(weekHref(MONDAY, 1, "person", 0)).toBe(
      `/timetable?week=${NEXT_MONDAY}&view=person`,
    );
    expect(weekHref(MONDAY, -1, "grid", 0)).toBe(
      `/timetable?week=${PREV_MONDAY}&view=grid`,
    );
  });

  it("keeps the selected day when the day view is active", () => {
    expect(weekHref(MONDAY, 1, "day", 3)).toBe(
      `/timetable?week=${NEXT_MONDAY}&view=day&day=3`,
    );
  });

  it("does not carry a day when the day view is not active", () => {
    expect(weekHref(MONDAY, 1, "grid", 3)).not.toContain("day=");
  });

  it("round-trips: stepping forward then back returns to the same week", () => {
    expect(addIsoDays(addIsoDays(MONDAY, 7), -7)).toBe(MONDAY);
  });

  it("labels the range the switcher shows", () => {
    const dict = getDictionary("en");
    expect(formatWeekLabel(MONDAY, dict)).toBe("3–9 Aug");
    expect(formatWeekLabel(NEXT_MONDAY, dict)).toBe("10–16 Aug");
  });

  it("has accessible names for both controls in each locale", () => {
    for (const locale of ["tr", "en"] as const) {
      const { calendar } = getDictionary(locale);
      expect(calendar.previousWeek).toBeTruthy();
      expect(calendar.nextWeek).toBeTruthy();
    }
  });
});

describe("view mode stays in the URL", () => {
  it("accepts the three supported modes and nothing else", () => {
    expect(resolveRosterView("grid")).toBe("grid");
    expect(resolveRosterView("person")).toBe("person");
    expect(resolveRosterView("day")).toBe("day");
    expect(resolveRosterView("gantt")).toBe("grid");
    expect(resolveRosterView(undefined)).toBe("grid");
  });

  it("clamps the day index to the week", () => {
    expect(resolveDayIndex("3", 0)).toBe(3);
    expect(resolveDayIndex("6", 0)).toBe(6);
    expect(resolveDayIndex("7", 2)).toBe(2);
    expect(resolveDayIndex("-1", 2)).toBe(2);
    expect(resolveDayIndex(undefined, 4)).toBe(4);
  });
});

describe("roster data behind the three views", () => {
  it("builds one row per person including task rows, task rows last", async () => {
    await createShift(STAFF, MONDAY, 9 * 60, 17 * 60);

    const roster = await getRosterWeek(MONDAY);
    const rows = buildRosterRows(roster.rows, getDictionary("en"));

    expect(rows).toHaveLength(2);
    expect(rows[rows.length - 1].isTaskRow).toBe(true);
    expect(rows[0].cells).toHaveLength(7);
  });

  it("keeps hours out of task rows", async () => {
    await createShift(TASK, MONDAY, 9 * 60, 17 * 60);

    const roster = await getRosterWeek(MONDAY);
    // Task rows are excluded from headcount and payroll; the roster still shows them.
    expect(roster.staffRows.every((r) => !r.employee.isTaskRow)).toBe(true);
    expect(roster.rows).toHaveLength(2);
  });

  it("builds seven day columns and marks today only inside the week", async () => {
    const roster = await getRosterWeek(MONDAY);
    const columns = buildDayColumns(roster.dates, getDictionary("en"), null);

    expect(columns).toHaveLength(7);
    expect(columns.every((c) => !c.isToday)).toBe(true);
    expect(buildDayColumns(roster.dates, getDictionary("en"), MONDAY)[0].isToday).toBe(true);
  });

  it("splits a day into on-shift and off, sorted by start time", async () => {
    await createShift(STAFF, MONDAY, 13 * 60, 18 * 60);
    await createShift(TASK, MONDAY, 8 * 60, 10 * 60);

    const roster = await getRosterWeek(MONDAY);
    const { onShift, off } = buildDayRows(roster.rows, MONDAY, getDictionary("en"));

    expect(onShift.map((r) => r.employeeId)).toEqual([TASK, STAFF]);
    expect(off).toHaveLength(0);
  });

  it("lists everyone as off on an empty day", async () => {
    const roster = await getRosterWeek(MONDAY);
    const { onShift, off } = buildDayRows(roster.rows, MONDAY, getDictionary("en"));

    expect(onShift).toHaveLength(0);
    expect(off).toHaveLength(2);
  });

  it("prints the same hour ticks regardless of data", () => {
    expect(buildHourTicks()).toEqual(["07:00", "10:00", "13:00", "16:00", "19:00"]);
  });
});

describe("off-day state stays accessible", () => {
  it("names every cell state, so colour is never the only signal", async () => {
    await createShift(STAFF, MONDAY, 9 * 60, 17 * 60);

    const dict = getDictionary("en");
    const roster = await getRosterWeek(MONDAY);
    const cells = buildRosterRows(roster.rows, dict)[0].cells;

    const worked = cells.find((c) => c.state === "shift")!;
    const idle = cells.find((c) => c.state === "off")!;

    expect(worked.stateLabel).toBe("09:00–17:00");
    expect(idle.stateLabel).toBe(dict.timetable.legendOff);
    expect(idle.primary).toBe("–");
  });
});
