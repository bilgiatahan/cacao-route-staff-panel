/**
 * `weekdayIndex` is the single source of truth for Monday-first weekday
 * conversion (R2). Before consolidation the same conversion existed in four
 * shapes across eight files:
 *
 *   A  (d.getDay() + 6) % 7
 *   B  const i = d.getDay(); i === 0 ? 6 : i - 1
 *   C  weekdayIndex(iso)                              ← kept
 *   D  a second inline `YYYY-MM-DD` parser in RosterBoard
 *
 * These lock the contract the call sites depend on, so a future edit to
 * `lib/date.ts` cannot quietly shift every day label by one.
 */

import { describe, expect, it } from "vitest";

import { fromIsoDate, startOfWeekIso, weekDates, weekdayIndex } from "@/lib/date";

/** The formula the five Form A call sites used, kept as an oracle. */
function formA(iso: string): number {
  return (fromIsoDate(iso).getDay() + 6) % 7;
}

/** The formula the three Form B call sites used. */
function formB(iso: string): number {
  const day = fromIsoDate(iso).getDay();
  return day === 0 ? 6 : day - 1;
}

describe("weekdayIndex — the Monday-first contract", () => {
  it("maps Monday to 0", () => {
    expect(weekdayIndex("2026-08-03")).toBe(0);
  });

  it("maps Sunday to 6", () => {
    expect(weekdayIndex("2026-08-09")).toBe(6);
  });

  it("maps a midweek day (Wednesday) to 2", () => {
    expect(weekdayIndex("2026-08-05")).toBe(2);
  });

  it("covers a full Monday-to-Sunday week in order", () => {
    const week = [
      "2026-08-03", // Mon
      "2026-08-04", // Tue
      "2026-08-05", // Wed
      "2026-08-06", // Thu
      "2026-08-07", // Fri
      "2026-08-08", // Sat
      "2026-08-09", // Sun
    ];
    expect(week.map(weekdayIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("equivalence with the formulas it replaced", () => {
  // A whole year, so every weekday × month combination is exercised.
  const yearOfDates = Array.from({ length: 365 }, (_, offset) => {
    const date = new Date(2026, 0, 1 + offset);
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  });

  it("agrees with Form A on every day of a year", () => {
    for (const iso of yearOfDates) {
      expect(weekdayIndex(iso)).toBe(formA(iso));
    }
  });

  it("agrees with Form B on every day of a year", () => {
    for (const iso of yearOfDates) {
      expect(weekdayIndex(iso)).toBe(formB(iso));
    }
  });

  it("never leaves the 0–6 range", () => {
    for (const iso of yearOfDates) {
      const index = weekdayIndex(iso);
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThanOrEqual(6);
    }
  });
});

describe("edge cases the application relies on", () => {
  it("indexes into weekDates() at the matching position", () => {
    // The invariant behind every day label: the Monday-first `dates` array and
    // the index have to agree, or the whole roster shifts by a day.
    const weekStart = "2026-08-03";
    const dates = weekDates(weekStart);
    for (const iso of dates) {
      expect(dates[weekdayIndex(iso)]).toBe(iso);
    }
  });

  it("returns 0 for the start of any week", () => {
    for (const iso of ["2026-08-03", "2026-01-01", "2024-02-29", "2025-12-29"]) {
      expect(weekdayIndex(startOfWeekIso(iso))).toBe(0);
    }
  });

  it("stays correct across a year boundary", () => {
    // The week of 2025-12-29 runs into January; summary.service slices
    // `myRow.cells` with this index, so a wrong answer reads the wrong day.
    expect(weekdayIndex("2025-12-29")).toBe(0); // Mon
    expect(weekdayIndex("2026-01-01")).toBe(3); // Thu
    expect(weekdayIndex("2026-01-04")).toBe(6); // Sun
    const dates = weekDates("2025-12-29");
    for (const iso of dates) {
      expect(dates[weekdayIndex(iso)]).toBe(iso);
    }
  });

  it("stays correct across a month boundary", () => {
    expect(weekdayIndex("2026-02-28")).toBe(5); // Sat
    expect(weekdayIndex("2026-03-01")).toBe(6); // Sun
  });

  it("handles a leap day", () => {
    expect(weekdayIndex("2024-02-29")).toBe(3); // Thu
  });

  it("is unaffected by the dates other regions shift the clock on", () => {
    // fromIsoDate builds local midnight rather than parsing as UTC, which is
    // what keeps day arithmetic from slipping. Turkey has had no DST since
    // 2016, but these are the dates that would expose a regression elsewhere.
    expect(weekdayIndex("2026-03-29")).toBe(6); // Sun
    expect(weekdayIndex("2026-10-25")).toBe(6); // Sun
  });

  it("is a pure function of the date string", () => {
    expect(weekdayIndex("2026-08-05")).toBe(weekdayIndex("2026-08-05"));
  });
});
