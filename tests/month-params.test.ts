/**
 * Calendar-month helpers.
 *
 * The monthly cost report is built entirely on these five, so a month whose
 * extent is wrong is a month whose money is wrong. February, leap years and the
 * December → January rollover are the three places `new Date` arithmetic
 * normally goes quiet, so each gets an assertion rather than a comment.
 *
 * `mondaysInMonth` is asserted here too — not because the report uses it (it
 * must not), but to pin that the two answers genuinely differ, which is the
 * reason the new helpers exist.
 */

import { describe, expect, it } from "vitest";

import {
  currentMonthIso,
  endOfMonthIso,
  isValidIsoMonth,
  mondaysInMonth,
  monthOfIsoDate,
  startOfMonthIso,
  toIsoMonth,
} from "@/lib/date";
import { resolveMonth } from "@/lib/week-params";

describe("isValidIsoMonth", () => {
  it("accepts a well-formed YYYY-MM", () => {
    expect(isValidIsoMonth("2026-08")).toBe(true);
    expect(isValidIsoMonth("2026-01")).toBe(true);
    expect(isValidIsoMonth("2026-12")).toBe(true);
  });

  it("rejects an out-of-range month", () => {
    expect(isValidIsoMonth("2026-13")).toBe(false);
    expect(isValidIsoMonth("2026-00")).toBe(false);
    expect(isValidIsoMonth("2026-99")).toBe(false);
  });

  it("rejects the wrong shape", () => {
    expect(isValidIsoMonth("2026-8")).toBe(false);
    expect(isValidIsoMonth("2026-08-01")).toBe(false);
    expect(isValidIsoMonth("26-08")).toBe(false);
    expect(isValidIsoMonth("")).toBe(false);
    expect(isValidIsoMonth("august")).toBe(false);
  });

  it("rejects anything that is not a string", () => {
    expect(isValidIsoMonth(undefined)).toBe(false);
    expect(isValidIsoMonth(null)).toBe(false);
    expect(isValidIsoMonth(202608)).toBe(false);
    expect(isValidIsoMonth({})).toBe(false);
  });
});

describe("month extent", () => {
  it("spans August 2026 from the 1st to the 31st", () => {
    expect(startOfMonthIso("2026-08")).toBe("2026-08-01");
    expect(endOfMonthIso("2026-08")).toBe("2026-08-31");
  });

  it("ends February on the 28th in a common year", () => {
    expect(startOfMonthIso("2026-02")).toBe("2026-02-01");
    expect(endOfMonthIso("2026-02")).toBe("2026-02-28");
    expect(endOfMonthIso("2025-02")).toBe("2025-02-28");
  });

  it("ends February on the 29th in a leap year", () => {
    expect(endOfMonthIso("2024-02")).toBe("2024-02-29");
    expect(endOfMonthIso("2028-02")).toBe("2028-02-29");
  });

  it("handles the century rule for leap years", () => {
    // 2000 is a leap year, 1900 and 2100 are not.
    expect(endOfMonthIso("2000-02")).toBe("2000-02-29");
    expect(endOfMonthIso("2100-02")).toBe("2100-02-28");
  });

  it("does not roll December into the wrong year", () => {
    expect(startOfMonthIso("2026-12")).toBe("2026-12-01");
    expect(endOfMonthIso("2026-12")).toBe("2026-12-31");
    expect(startOfMonthIso("2027-01")).toBe("2027-01-01");
    expect(endOfMonthIso("2027-01")).toBe("2027-01-31");
  });

  it("gives every month of 2026 the right last day", () => {
    const lastDays = Array.from({ length: 12 }, (_, index) =>
      endOfMonthIso(`2026-${`${index + 1}`.padStart(2, "0")}`),
    );

    expect(lastDays).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
      "2026-06-30",
      "2026-07-31",
      "2026-08-31",
      "2026-09-30",
      "2026-10-31",
      "2026-11-30",
      "2026-12-31",
    ]);
  });

  it("keeps the extent inside its own month", () => {
    for (const month of ["2024-02", "2026-08", "2026-12", "2027-01"]) {
      expect(startOfMonthIso(month).startsWith(month)).toBe(true);
      expect(endOfMonthIso(month).startsWith(month)).toBe(true);
    }
  });
});

describe("toIsoMonth / monthOfIsoDate", () => {
  it("reads the month off a local-midnight date", () => {
    expect(toIsoMonth(new Date(2026, 7, 31))).toBe("2026-08");
    expect(toIsoMonth(new Date(2026, 0, 1))).toBe("2026-01");
    expect(toIsoMonth(new Date(2026, 11, 31))).toBe("2026-12");
  });

  it("narrows a date to its month without slipping a day", () => {
    // The first and last day of a month are where a UTC-parsed date would drift.
    expect(monthOfIsoDate("2026-08-01")).toBe("2026-08");
    expect(monthOfIsoDate("2026-08-31")).toBe("2026-08");
    expect(monthOfIsoDate("2026-12-31")).toBe("2026-12");
    expect(monthOfIsoDate("2027-01-01")).toBe("2027-01");
  });

  it("agrees with the current month", () => {
    expect(isValidIsoMonth(currentMonthIso())).toBe(true);
  });
});

describe("resolveMonth", () => {
  it("passes a valid month through untouched", () => {
    expect(resolveMonth("2026-08")).toBe("2026-08");
    expect(resolveMonth("2024-02")).toBe("2024-02");
  });

  it("narrows a full date to its month", () => {
    expect(resolveMonth("2026-08-17")).toBe("2026-08");
    expect(resolveMonth("2026-12-31")).toBe("2026-12");
  });

  it("falls back to the current month for anything invalid", () => {
    const now = currentMonthIso();

    expect(resolveMonth(undefined)).toBe(now);
    expect(resolveMonth("")).toBe(now);
    expect(resolveMonth("2026-13")).toBe(now);
    expect(resolveMonth("2026-02-30")).toBe(now);
    expect(resolveMonth("last-month")).toBe(now);
  });
});

describe("mondaysInMonth is a different question", () => {
  it("counts Mondays, not weeks touching the month", () => {
    // The reason the report may not use it: August 2026 starts on a Saturday, so
    // six Monday–Sunday weeks touch it but only five Mondays fall inside it.
    expect(mondaysInMonth("2026-08-03")).toBe(5);
  });
});
