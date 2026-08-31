/**
 * Who is allowed to see pay.
 *
 * The rule has one implementation — `canViewPay` — and four call sites that all
 * ask it the same question: the pay tab in both navs, the summary's earnings
 * card, the payroll route itself, and the wage row on Profile. So these cover
 * the rule and the action that writes it, not each screen: a screen that stopped
 * asking would be a missing call, which no unit test can see.
 *
 * Against a real Postgres because the interesting cases are about a row that
 * does not exist yet and an upsert that has to create it.
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

const STAFF: SessionUser = {
  userId: "user-staff",
  employeeId: "emp-staff",
  email: "staff@example.test",
  role: "staff",
  fullName: "Staff Test",
};

// `refresh()` only works inside a real Server Action invocation.
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const assertAdmin = vi.fn(async () => ADMIN);
vi.mock("@/server/auth/session", () => ({
  assertAdmin: () => assertAdmin(),
  assertAuthenticated: () => assertAdmin(),
}));

const { updateSettingsAction } = await import("@/server/actions/settings.actions");
const { settingsRepository, DEFAULT_APP_SETTINGS } = await import(
  "@/server/repositories/settings.repository"
);
const { canViewPay } = await import("@/server/services/settings.service");
const { prisma } = await import("@/server/db/client");
const { resetDatabase } = await import("./support/fixtures");

/** The form the settings screen posts. An off switch sends no field at all. */
function form(staffCanSeePay: boolean): FormData {
  const data = new FormData();
  if (staffCanSeePay) data.set("staffCanSeePay", "on");
  return data;
}

beforeEach(async () => {
  vi.clearAllMocks();
  assertAdmin.mockImplementation(async () => ADMIN);
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("defaults", () => {
  it("reads as visible before anything has ever been saved", async () => {
    // A fresh database has no settings row; the pre-feature behaviour was that
    // staff saw their pay, and a migration must not quietly change that.
    expect(await settingsRepository.get()).toEqual(DEFAULT_APP_SETTINGS);
    expect(DEFAULT_APP_SETTINGS.staffCanSeePay).toBe(true);
    expect(await canViewPay(STAFF)).toBe(true);
  });
});

describe("canViewPay", () => {
  it("hides pay from staff once the switch is off", async () => {
    await settingsRepository.update({ staffCanSeePay: false });
    expect(await canViewPay(STAFF)).toBe(false);
  });

  it("never hides pay from an admin", async () => {
    await settingsRepository.update({ staffCanSeePay: false });
    // The admin sets the wages; hiding them would only hide their own screens.
    expect(await canViewPay(ADMIN)).toBe(true);
  });
});

describe("updateSettingsAction", () => {
  it("creates the row on the very first save", async () => {
    const result = await updateSettingsAction(null, form(false));

    expect(result).toEqual({ ok: true });
    expect(await settingsRepository.get()).toEqual({ staffCanSeePay: false });
    expect(await prisma.appSettings.count()).toBe(1);
  });

  it("switches back on without adding a second row", async () => {
    await updateSettingsAction(null, form(false));
    await updateSettingsAction(null, form(true));

    expect(await settingsRepository.get()).toEqual({ staffCanSeePay: true });
    expect(await prisma.appSettings.count()).toBe(1);
  });

  it("refuses a non-admin and writes nothing", async () => {
    assertAdmin.mockImplementation(async () => {
      throw new AuthorizationError("forbidden");
    });

    const result = await updateSettingsAction(null, form(false));

    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(await prisma.appSettings.count()).toBe(0);
  });
});
