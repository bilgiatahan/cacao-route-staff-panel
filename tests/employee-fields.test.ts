/**
 * The manager's editor validates what the person's own form validates.
 *
 * `EmployeeForm` used to check one thing: that a first name was present. So a
 * manager could save a phone number, an email address or a birth date that
 * `updateProfileAction` would then refuse — leaving the person unable to edit
 * their own record until someone went back into the admin form and fixed it.
 *
 * The headline test is the agreement one: the same value, put through both
 * actions, has to be accepted by both or rejected by both. Everything else here
 * is the individual rules and the two bugs that came out with them — a wage step
 * that made £10.25 unenterable, and a hourly-rate fallback still denominated in
 * lira.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/types/domain";

const ME = "emp-me";
const ADMIN: SessionUser = {
  userId: "user-me",
  employeeId: ME,
  email: "me@example.test",
  role: "admin",
  fullName: "Me Test",
};

vi.mock("next/cache", () => ({ refresh: vi.fn() }));

// `createEmployeeAction` finishes by redirecting, which throws by design.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const assertAdmin = vi.fn(async () => ADMIN);
vi.mock("@/server/auth/session", () => ({
  assertAdmin: () => assertAdmin(),
  assertAuthenticated: () => assertAdmin(),
}));

const { createEmployeeAction, updateEmployeeAction } = await import(
  "@/server/actions/employee.actions"
);
const { updateProfileAction } = await import("@/server/actions/profile.actions");
const { employeeRepository } = await import("@/server/repositories/employee.repository");
const { PERSON_RULES } = await import("@/lib/forms/rules");
const { prisma } = await import("@/server/db/client");
const { createEmployee, resetDatabase } = await import("./support/fixtures");

/** What `EmployeeForm` posts, with everything valid by default. */
function managerForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const base: Record<string, string> = {
    firstName: "Ayse",
    lastName: "Yilmaz",
    position: "Barista",
    contract: "part",
    birthDate: "1996-04-02",
    hiredAt: "2025-01-06",
    hourlyRate: "10.25",
    leaveBalance: "10",
    phone: "07123 456789",
    email: "ayse@example.test",
    address: "12 Camden High Street, London",
  };
  for (const [k, v] of Object.entries({ ...base, ...overrides })) data.set(k, v);
  return data;
}

/** What `ProfileForm` posts — the same fields, minus the payroll ones. */
function ownForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const base: Record<string, string> = {
    firstName: "Ayse",
    lastName: "Yilmaz",
    birthDate: "1996-04-02",
    phone: "07123 456789",
    email: "ayse@example.test",
    address: "12 Camden High Street, London",
  };
  for (const [k, v] of Object.entries({ ...base, ...overrides })) data.set(k, v);
  return data;
}

beforeEach(async () => {
  vi.clearAllMocks();
  assertAdmin.mockImplementation(async () => ADMIN);
  await resetDatabase();
  await createEmployee(ME, "Me", { role: "admin", sortOrder: 0 });
  await prisma.user.create({
    data: {
      id: "user-me",
      email: "me@example.test",
      passwordHash: "$2a$10$notarealhashbutlongenoughtostore",
      employeeId: ME,
    },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

/* --------------------------------------------------------- the whole point -- */

describe("both forms agree about a value", () => {
  /** Field name → values that must be accepted, and values that must not. */
  const CASES: Array<{ field: string; good: string[]; bad: string[] }> = [
    {
      field: "phone",
      good: ["07123 456789", "020 7123 4567", "+44 7700 900101", ""],
      bad: ["0712", "+90 532 118 4407", "(0212) 555 1234", "call me"],
    },
    {
      field: "firstName",
      good: ["Al", "Ayse"],
      bad: ["A", "x".repeat(PERSON_RULES.firstName.maxLength + 1)],
    },
    {
      field: "birthDate",
      good: ["1996-04-02", "1960-12-31", ""],
      bad: ["2026-08-01", "2040-01-01", "1850-01-01"],
    },
    {
      field: "email",
      good: ["a.b+tag@example.co.uk", "ME@Example.Test"],
      bad: ["nope", "no@domain", "a b@c.test"],
    },
    {
      field: "address",
      good: ["12 Camden High Street", ""],
      bad: ["x".repeat(PERSON_RULES.address.maxLength + 1)],
    },
  ];

  for (const { field, good, bad } of CASES) {
    it(`accepts the same ${field} values on both`, async () => {
      for (const value of good) {
        const own = await updateProfileAction(null, ownForm({ [field]: value }));
        const manager = await updateEmployeeAction(ME, null, managerForm({ [field]: value }));

        expect(own, `own/${field}=${JSON.stringify(value)}`).toEqual({ ok: true });
        expect(manager, `manager/${field}=${JSON.stringify(value)}`).toEqual({ ok: true });
      }
    });

    it(`rejects the same ${field} values on both, with the same key`, async () => {
      for (const value of bad) {
        const own = await updateProfileAction(null, ownForm({ [field]: value }));
        const manager = await updateEmployeeAction(ME, null, managerForm({ [field]: value }));

        expect(own.ok, `own/${field}=${JSON.stringify(value)}`).toBe(false);
        expect(manager, `manager/${field}=${JSON.stringify(value)}`).toEqual(own);
      }
    });
  }
});

/* ------------------------------------------------------- the one difference -- */

describe("email is the one field the two forms treat differently", () => {
  it("lets the manager leave it blank, because a roster row need not have a login", async () => {
    // A task row like "Cleaning", or someone whose account is set up later.
    expect(await updateEmployeeAction(ME, null, managerForm({ email: "" }))).toEqual({
      ok: true,
    });
  });

  it("refuses a blank one on the profile form, where it is the sign-in", async () => {
    expect(await updateProfileAction(null, ownForm({ email: "" }))).toEqual({
      ok: false,
      error: "emailRequired",
    });
  });

  it("still validates the format when the manager does supply one", async () => {
    expect(await updateEmployeeAction(ME, null, managerForm({ email: "nope" }))).toEqual({
      ok: false,
      error: "invalidEmail",
    });
  });
});

/* --------------------------------------------------------- manager-only fields -- */

describe("the fields only the manager's form has", () => {
  it("writes a valid rate with pence intact", async () => {
    expect(await updateEmployeeAction(ME, null, managerForm({ hourlyRate: "10.25" }))).toEqual(
      { ok: true },
    );
    expect((await employeeRepository.findById(ME))?.hourlyRate).toBe(10.25);
  });

  it("no longer falls back to a lira-era rate when the field is missing", async () => {
    // The old default was 130. A wrong number that looks plausible is worse than
    // a zero the manager can see on screen.
    const data = managerForm();
    data.delete("hourlyRate");

    expect(await updateEmployeeAction(ME, null, data)).toEqual({ ok: true });
    expect((await employeeRepository.findById(ME))?.hourlyRate).toBe(0);
  });

  it("refuses a position longer than the rule allows", async () => {
    const position = "x".repeat(PERSON_RULES.position.maxLength + 1);

    expect(await updateEmployeeAction(ME, null, managerForm({ position }))).toEqual({
      ok: false,
      error: "valueTooLong",
    });
  });

  it("feeds one position field into both locales", async () => {
    await updateEmployeeAction(ME, null, managerForm({ position: "Shift Lead" }));

    expect((await employeeRepository.findById(ME))?.position).toEqual({
      tr: "Shift Lead",
      en: "Shift Lead",
    });
  });

  it("ignores a malformed hire date rather than failing", async () => {
    expect(await updateEmployeeAction(ME, null, managerForm({ hiredAt: "nope" }))).toEqual({
      ok: true,
    });
    expect((await employeeRepository.findById(ME))?.hiredAt).toBeNull();
  });
});

/* ------------------------------------------------------------------ passwords -- */

describe("passwords on the manager's form", () => {
  it("refuses one under the minimum", async () => {
    expect(
      await updateEmployeeAction(ME, null, managerForm({ password: "short" })),
    ).toEqual({ ok: false, error: "passwordTooShort" });
  });

  it("refuses one past bcrypt's 72-byte ceiling", async () => {
    // The same rule `changePasswordAction` applies, counted the same way: 40
    // two-byte characters is 80 bytes, and bcrypt would ignore everything after
    // the 72nd while appearing to accept it.
    const password = "ş".repeat(40);
    expect(new TextEncoder().encode(password).length).toBeGreaterThan(72);

    expect(await updateEmployeeAction(ME, null, managerForm({ password }))).toEqual({
      ok: false,
      error: "passwordTooLong",
    });
  });
});

/* ------------------------------------------------------------------- creating -- */

describe("creating a person applies the same rules", () => {
  /** `createEmployeeAction` redirects on success, which throws. */
  async function create(data: FormData) {
    try {
      return await createEmployeeAction(null, data);
    } catch (error) {
      const message = (error as Error).message;
      if (message.startsWith("REDIRECT:")) return { ok: true as const, redirect: message };
      throw error;
    }
  }

  it("creates with valid details", async () => {
    const result = await create(managerForm({ email: "new@example.test" }));

    expect(result.ok).toBe(true);
    expect((await employeeRepository.listStaff()).map((e) => e.firstName)).toContain("Ayse");
  });

  it("refuses a non-UK phone number before writing anything", async () => {
    const before = (await employeeRepository.listStaff()).length;

    expect(
      await create(managerForm({ email: "new@example.test", phone: "+90 532 118 4407" })),
    ).toEqual({ ok: false, error: "invalidPhone" });
    expect((await employeeRepository.listStaff()).length).toBe(before);
  });

  it("still refuses a blank first name", async () => {
    expect(await create(managerForm({ firstName: "  " }))).toEqual({
      ok: false,
      error: "nameRequired",
    });
  });

  it("distinguishes an absent name from a too-short one", async () => {
    expect(await create(managerForm({ firstName: "A" }))).toEqual({
      ok: false,
      error: "nameTooShort",
    });
  });
});
