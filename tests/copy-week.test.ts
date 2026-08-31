/**
 * Copying last week's roster is all-or-nothing, and only ever over the roster.
 *
 * The two ways this write can go wrong are both invisible from a mock: the week
 * is unique on `[employeeId, date]`, so an insert that ran before the target
 * week was cleared would collide on every overlapping day; and a delete that
 * committed without its insert would leave the week wiped rather than copied.
 * Both are properties of a real `BEGIN`/`ROLLBACK`, so these run against a real
 * Postgres like `swap-approval` does.
 *
 * The rest pins the rules the action is responsible for: an empty source week
 * must not be read as "clear this week", the copy must land on the matching
 * weekday, and people who are not on the roster must be left alone in both
 * directions — neither copied forward nor deleted.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "@/lib/auth-error";
import type { SessionUser } from "@/types/domain";

const ADMIN: SessionUser = {
  userId: "user-admin",
  employeeId: "emp-admin",
  email: "admin@example.test",
  role: "admin",
  fullName: "Admin Test",
};

// `refresh()` only works inside a real Server Action invocation.
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const assertAdmin = vi.fn(async () => ADMIN);
const assertAuthenticated = vi.fn(async () => ADMIN);
vi.mock("@/server/auth/session", () => ({
  assertAdmin: () => assertAdmin(),
  assertAuthenticated: () => assertAuthenticated(),
}));

const { copyPreviousWeekAction } = await import("@/server/actions/shift.actions");
const { getPreviousWeekPreview, getRosterWeek } = await import(
  "@/server/services/roster.service"
);
const { prisma } = await import("@/server/db/client");
const { createEmployee, createShift, resetDatabase, shiftOwnerOn } = await import(
  "./support/fixtures"
);

/** `MONDAY` from the fixtures is the source week; the copy lands a week later. */
const LAST_MONDAY = "2026-08-03";
const LAST_WEDNESDAY = "2026-08-05";
const LAST_SUNDAY = "2026-08-09";
const THIS_MONDAY = "2026-08-10";
const THIS_WEDNESDAY = "2026-08-12";
const THIS_SUNDAY = "2026-08-16";

const ALEX = "emp-alex";
const SAM = "emp-sam";
const CLEANING = "emp-cleaning";

beforeEach(async () => {
  vi.clearAllMocks();
  assertAdmin.mockImplementation(async () => ADMIN);
  await resetDatabase();
  await createEmployee("emp-admin", "Admin", { role: "admin", sortOrder: 0 });
  await createEmployee(ALEX, "Alex", { sortOrder: 1 });
  await createEmployee(SAM, "Sam", { sortOrder: 2 });
  await createEmployee(CLEANING, "Cleaning", { isTaskRow: true, sortOrder: 3 });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("copying a week", () => {
  it("writes last week's shifts onto the matching weekdays", async () => {
    await createShift(ALEX, LAST_MONDAY, 8 * 60, 16 * 60);
    await createShift(SAM, LAST_SUNDAY, 12 * 60, 20 * 60);

    const result = await copyPreviousWeekAction(THIS_MONDAY);

    expect(result).toEqual({ ok: true });
    expect(await shiftOwnerOn(THIS_MONDAY, ALEX)).toMatchObject({
      startMinutes: 8 * 60,
      endMinutes: 16 * 60,
    });
    expect(await shiftOwnerOn(THIS_SUNDAY, SAM)).toMatchObject({
      startMinutes: 12 * 60,
      endMinutes: 20 * 60,
    });
  });

  it("leaves the source week untouched", async () => {
    await createShift(ALEX, LAST_WEDNESDAY);

    await copyPreviousWeekAction(THIS_MONDAY);

    expect(await shiftOwnerOn(LAST_WEDNESDAY, ALEX)).not.toBeNull();
    expect(await prisma.shift.count()).toBe(2);
  });

  it("copies task rows, which are scheduled work that is not a person", async () => {
    await createShift(CLEANING, LAST_WEDNESDAY);

    await copyPreviousWeekAction(THIS_MONDAY);

    expect(await shiftOwnerOn(THIS_WEDNESDAY, CLEANING)).not.toBeNull();
  });

  it("normalises a mid-week date to its Monday", async () => {
    await createShift(ALEX, LAST_MONDAY);

    // The URL can carry any day of the week; the copy still fills Mon–Sun.
    const result = await copyPreviousWeekAction(THIS_WEDNESDAY);

    expect(result).toEqual({ ok: true });
    expect(await shiftOwnerOn(THIS_MONDAY, ALEX)).not.toBeNull();
  });
});

describe("replacing what is already there", () => {
  it("replaces the target week rather than merging into it", async () => {
    await createShift(ALEX, LAST_MONDAY, 8 * 60, 16 * 60);
    // Sam works this week but not last: after the copy the week is last week's,
    // so Sam's day is gone rather than left standing beside the copy.
    await createShift(SAM, THIS_WEDNESDAY);
    await createShift(ALEX, THIS_MONDAY, 10 * 60, 18 * 60);

    await copyPreviousWeekAction(THIS_MONDAY);

    expect(await shiftOwnerOn(THIS_WEDNESDAY, SAM)).toBeNull();
    expect(await shiftOwnerOn(THIS_MONDAY, ALEX)).toMatchObject({
      startMinutes: 8 * 60,
      endMinutes: 16 * 60,
    });
  });

  it("does not collide when the same person already works the same day", async () => {
    // The regression the transaction ordering exists for: `[employeeId, date]`
    // is unique, so inserting before the delete would fail here.
    await createShift(ALEX, LAST_MONDAY, 8 * 60, 16 * 60);
    await createShift(ALEX, THIS_MONDAY, 9 * 60, 17 * 60);

    const result = await copyPreviousWeekAction(THIS_MONDAY);

    expect(result).toEqual({ ok: true });
    expect(await prisma.shift.count({ where: { employeeId: ALEX } })).toBe(2);
  });
});

describe("an empty source week", () => {
  it("reports that there is nothing to copy", async () => {
    const result = await copyPreviousWeekAction(THIS_MONDAY);

    expect(result).toEqual({ ok: false, error: "nothingToCopy" });
  });

  it("does not clear the week it was asked to fill", async () => {
    await createShift(SAM, THIS_WEDNESDAY);

    await copyPreviousWeekAction(THIS_MONDAY);

    expect(await shiftOwnerOn(THIS_WEDNESDAY, SAM)).not.toBeNull();
  });
});

describe("people who are not on the roster", () => {
  it("neither copies nor deletes an admin's shifts", async () => {
    await createShift(ALEX, LAST_MONDAY);
    // An admin does not hold a roster row (`isRosterMember`), so a stray shift
    // of theirs is outside what this write owns.
    await createShift("emp-admin", LAST_WEDNESDAY);
    await createShift("emp-admin", THIS_WEDNESDAY);

    await copyPreviousWeekAction(THIS_MONDAY);

    expect(await shiftOwnerOn(THIS_WEDNESDAY, "emp-admin")).not.toBeNull();
    expect(await prisma.shift.count({ where: { employeeId: "emp-admin" } })).toBe(2);
  });

  it("leaves an archived person's week alone", async () => {
    await createEmployee("emp-gone", "Gone", { sortOrder: 4 });
    await prisma.employee.update({
      where: { id: "emp-gone" },
      data: { archivedAt: new Date() },
    });
    await createShift(ALEX, LAST_MONDAY);
    await createShift("emp-gone", THIS_WEDNESDAY);

    await copyPreviousWeekAction(THIS_MONDAY);

    expect(await shiftOwnerOn(THIS_WEDNESDAY, "emp-gone")).not.toBeNull();
  });
});

describe("authorization", () => {
  it("refuses a signed-in employee who is not an admin", async () => {
    await createShift(ALEX, LAST_MONDAY);
    assertAdmin.mockImplementation(async () => {
      throw new AuthorizationError("forbidden");
    });

    const result = await copyPreviousWeekAction(THIS_MONDAY);

    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(await shiftOwnerOn(THIS_MONDAY, ALEX)).toBeNull();
  });

  it("rejects a date that is not a date before touching the database", async () => {
    await createShift(ALEX, LAST_MONDAY);

    const result = await copyPreviousWeekAction("2026-02-30");

    expect(result).toEqual({ ok: false, error: "notFound" });
    expect(await prisma.shift.count()).toBe(1);
  });
});

describe("the preview the button is built from", () => {
  it("counts what would be written and what would be lost", async () => {
    await createShift(ALEX, LAST_MONDAY);
    await createShift(SAM, LAST_SUNDAY);
    await createShift(SAM, THIS_WEDNESDAY);

    const preview = await getPreviousWeekPreview(await getRosterWeek(THIS_MONDAY));

    expect(preview).toEqual({
      sourceWeekStart: LAST_MONDAY,
      sourceCount: 2,
      targetCount: 1,
    });
  });

  it("counts over the roster, not over the shift table", async () => {
    // Both of these are real rows that the copy will not touch, so neither may
    // show up in a number offered to the admin as what the copy will do.
    await createShift("emp-admin", LAST_MONDAY);
    await createShift(ALEX, LAST_WEDNESDAY);

    const preview = await getPreviousWeekPreview(await getRosterWeek(THIS_MONDAY));

    expect(preview.sourceCount).toBe(1);
    expect(preview.targetCount).toBe(0);
  });
});
