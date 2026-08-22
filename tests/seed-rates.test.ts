/**
 * What an `hourlyRate` means, pinned.
 *
 * The demo roster once carried Turkish lira figures (145, 180, 185) that were
 * rendered with a `£` after the panel moved to London — a barista apparently on
 * £145 an hour. Nothing had scaled the number; the seed simply kept the old
 * currency's magnitude under a new symbol.
 *
 * So there are two things worth a test rather than a comment:
 *
 *   1. the unit — pounds, decimal, not pence and not a scaled integer — held all
 *      the way from a blueprint through `Decimal(10, 2)` and back out again
 *   2. the seeded rates themselves, as exact deterministic values, so the next
 *      currency or locale change cannot quietly leave them behind
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { EMPLOYEE_BLUEPRINTS } from "@/server/db/seed-data";
import { calculateWeeklyPay } from "@/lib/domain/payroll";
import { formatMoney } from "@/lib/format";

const { employeeRepository } = await import("@/server/repositories/employee.repository");
const { prisma } = await import("@/server/db/client");
const { resetDatabase } = await import("./support/fixtures");

/** The placeholder band this deployment's demo data is meant to sit in. */
const MIN_RATE = 10;
const MAX_RATE = 10.5;

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("the unit is pounds", () => {
  it("survives the round trip through Decimal(10, 2) unscaled", async () => {
    // £10.25 stored as 10.25. If the column held pence this would come back as
    // 1025, and if it held an integer it would come back as 10.
    const created = await employeeRepository.create({
      firstName: "Rate",
      lastName: "Probe",
      position: { tr: "Barista", en: "Barista" },
      hourlyRate: 10.25,
      contract: "part",
      birthDate: null,
      hiredAt: null,
      leaveBalance: 0,
      phone: "",
      email: "",
      address: "",
      role: "staff",
      isTaskRow: false,
    });

    expect(created.hourlyRate).toBe(10.25);
    expect((await employeeRepository.findById(created.id))?.hourlyRate).toBe(10.25);
  });

  it("keeps the pence when a rate is updated", async () => {
    const created = await employeeRepository.create({
      firstName: "Rate",
      lastName: "Probe",
      position: { tr: "Barista", en: "Barista" },
      hourlyRate: 10,
      contract: "part",
      birthDate: null,
      hiredAt: null,
      leaveBalance: 0,
      phone: "",
      email: "",
      address: "",
      role: "staff",
      isTaskRow: false,
    });

    const updated = await employeeRepository.update(created.id, { hourlyRate: 10.5 });

    expect(updated?.hourlyRate).toBe(10.5);
  });

  it("needs no conversion to reach a formatted wage", () => {
    // The stored number is already pounds, so pay and formatting are direct.
    expect(calculateWeeklyPay(8, 10.25).total).toBe(82);
    expect(formatMoney(calculateWeeklyPay(8, 10.25).total)).toBe("£82.00");
    expect(formatMoney(10.5)).toBe("£10.50");
  });
});

describe("seeded demo rates", () => {
  const people = EMPLOYEE_BLUEPRINTS.filter((blueprint) => !blueprint.isTaskRow);

  it("gives everyone a rate inside the placeholder band", () => {
    for (const person of people) {
      expect(person.hourlyRate).toBeGreaterThanOrEqual(MIN_RATE);
      expect(person.hourlyRate).toBeLessThanOrEqual(MAX_RATE);
    }
  });

  it("puts nobody anywhere near a lira-era figure", () => {
    // The exact shape of the original bug: a three-figure hourly rate.
    for (const person of people) {
      expect(person.hourlyRate).toBeLessThan(100);
    }
  });

  it("holds the exact deterministic set", () => {
    expect(
      EMPLOYEE_BLUEPRINTS.map((blueprint) => [blueprint.firstName, blueprint.hourlyRate]),
    ).toEqual([
      ["Ahmed", 10],
      ["Anima", 10.5],
      ["Angila", 10],
      ["Ella", 10],
      ["Veronica", 10.25],
      ["Annabel", 10],
      ["Erin", 10],
      ["Bushra", 10.5],
      ["Rumesh", 10.25],
      // Task rows are scheduled work, not a wage.
      ["Temizlik", 0],
    ]);
  });

  it("expresses every rate in whole pence", () => {
    for (const person of EMPLOYEE_BLUEPRINTS) {
      expect(Number.isInteger(Math.round(person.hourlyRate * 100))).toBe(true);
      // Decimal(10, 2) would silently round a third decimal place away.
      expect(person.hourlyRate * 100).toBeCloseTo(Math.round(person.hourlyRate * 100), 9);
    }
  });

  it("leaves the task row unpaid", () => {
    const task = EMPLOYEE_BLUEPRINTS.filter((blueprint) => blueprint.isTaskRow);

    expect(task).toHaveLength(1);
    expect(task[0].hourlyRate).toBe(0);
  });
});
