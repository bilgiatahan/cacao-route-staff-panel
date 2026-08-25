/**
 * Profile screen behaviour.
 *
 * The most valuable test here is still the read-only guarantee: the work-details
 * card claims the manager owns position, contract, wage and leave balance, and
 * this proves the self-service action cannot touch them however the form is
 * posted.
 *
 * The password moved out of `updateProfileAction` into `changePasswordAction`,
 * so the two are exercised separately — and the separation itself is pinned:
 * neither action may reach into the other's fields. A profile save must not be
 * able to set a password, and a password change must not need a name.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "@/lib/auth-error";
import type { SessionUser } from "@/types/domain";

const ME = "emp-me";
const SESSION: SessionUser = {
  userId: "user-me",
  employeeId: ME,
  email: "me@example.test",
  role: "staff",
  fullName: "Me Test",
};

vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const assertAuthenticated = vi.fn(async () => SESSION);
vi.mock("@/server/auth/session", () => ({
  assertAdmin: () => assertAuthenticated(),
  assertAuthenticated: () => assertAuthenticated(),
}));

const { changePasswordAction, updateProfileAction } = await import(
  "@/server/actions/profile.actions"
);
const { employeeRepository } = await import(
  "@/server/repositories/employee.repository"
);
const { userRepository } = await import("@/server/repositories/user.repository");
const { prisma } = await import("@/server/db/client");
const { createEmployee, resetDatabase } = await import("./support/fixtures");
const { hash, compare } = await import("bcryptjs");

const PASSWORD = "currentpw123";
let passwordHash = "";

/** What the contact-details form posts, with sensible defaults. */
function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const base: Record<string, string> = {
    firstName: "Me",
    lastName: "Test",
    birthDate: "",
    // A UK number in the shape the mask produces. The field is UK-only now.
    phone: "07123 456789",
    email: "me@example.test",
    address: "Kadikoy",
  };
  for (const [k, v] of Object.entries({ ...base, ...overrides })) data.set(k, v);
  return data;
}

/** What the password form posts. */
function passwordForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const base: Record<string, string> = {
    currentPassword: PASSWORD,
    newPassword: "brandnewpw1",
    confirmPassword: "brandnewpw1",
  };
  for (const [k, v] of Object.entries({ ...base, ...overrides })) data.set(k, v);
  return data;
}

beforeEach(async () => {
  vi.clearAllMocks();
  assertAuthenticated.mockImplementation(async () => SESSION);
  await resetDatabase();
  await createEmployee(ME, "Me", { sortOrder: 0 });
  passwordHash = await hash(PASSWORD, 10);
  await prisma.user.create({
    data: { id: "user-me", email: "me@example.test", passwordHash, employeeId: ME },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("saving contact details", () => {
  it("succeeds and writes every editable field", async () => {
    const result = await updateProfileAction(
      null,
      form({
        firstName: "Ayse",
        lastName: "Yilmaz",
        phone: "020 7123 4567",
        address: "Moda",
        birthDate: "1996-04-02",
      }),
    );

    expect(result).toEqual({ ok: true });
    const after = await employeeRepository.findById(ME);
    expect(after?.firstName).toBe("Ayse");
    expect(after?.lastName).toBe("Yilmaz");
    expect(after?.phone).toBe("020 7123 4567");
    expect(after?.address).toBe("Moda");
    expect(after?.birthDate).toBe("1996-04-02");
  });

  it("ignores a malformed birth date rather than failing", async () => {
    expect(await updateProfileAction(null, form({ birthDate: "nope" }))).toEqual({
      ok: true,
    });
    expect((await employeeRepository.findById(ME))?.birthDate).toBeNull();
  });
});

describe("the read-only facts stay read-only", () => {
  it("cannot change position, contract, wage, leave balance or role", async () => {
    const before = await employeeRepository.findById(ME);

    // Everything the work-details card shows, posted as if the form had fields
    // for it. The action reads none of these keys.
    const result = await updateProfileAction(
      null,
      form({
        position: "Manager",
        contract: "full",
        hourlyRate: "9999",
        leaveBalance: "365",
        role: "admin",
        isTaskRow: "true",
      }),
    );

    expect(result).toEqual({ ok: true });
    const after = await employeeRepository.findById(ME);
    expect(after?.position).toEqual(before?.position);
    expect(after?.contract).toBe(before?.contract);
    expect(after?.hourlyRate).toBe(before?.hourlyRate);
    expect(after?.leaveBalance).toBe(before?.leaveBalance);
    expect(after?.role).toBe("staff");
    expect(after?.isTaskRow).toBe(false);
  });
});

describe("validation still attributes to a field", () => {
  it("rejects a blank first name", async () => {
    expect(await updateProfileAction(null, form({ firstName: "  " }))).toEqual({
      ok: false,
      error: "nameRequired",
    });
  });

  it("rejects a blank email", async () => {
    expect(await updateProfileAction(null, form({ email: "" }))).toEqual({
      ok: false,
      error: "emailRequired",
    });
  });

  it("rejects an email another active person signs in with", async () => {
    await createEmployee("emp-other", "Other", { sortOrder: 1 });
    await prisma.user.create({
      data: {
        id: "user-other",
        email: "taken@example.test",
        passwordHash,
        employeeId: "emp-other",
      },
    });

    expect(
      await updateProfileAction(null, form({ email: "taken@example.test" })),
    ).toEqual({ ok: false, error: "emailTaken" });
  });
});

describe("input rules", () => {
  it("rejects a one-character first name", async () => {
    expect(await updateProfileAction(null, form({ firstName: "A" }))).toEqual({
      ok: false,
      error: "nameTooShort",
    });
  });

  it("rejects an address that is not an address", async () => {
    for (const email of ["nope", "no@domain", "@example.test", "a b@c.test"]) {
      expect(await updateProfileAction(null, form({ email })), email).toEqual({
        ok: false,
        error: "invalidEmail",
      });
    }
  });

  it("accepts the shapes real addresses come in", async () => {
    for (const email of ["a.b+tag@example.co.uk", "ME@Example.Test"]) {
      expect(await updateProfileAction(null, form({ email })), email).toEqual({ ok: true });
    }
  });

  it("rejects anything that is not a dialable UK number", async () => {
    for (const phone of [
      "0712", // incomplete
      "call me", // no digits at all
      "+90 532 118 4407", // a real number, but not a UK one
      "(0212) 555 1234", // 021 is not an allocated UK area code
      "0412 345 678", // the 04 range is unallocated
    ]) {
      expect(await updateProfileAction(null, form({ phone })), phone).toEqual({
        ok: false,
        error: "invalidPhone",
      });
    }
  });

  it("accepts UK numbers however they are written", async () => {
    for (const phone of [
      "07123 456789",
      "07123456789",
      "+44 7700 900101",
      "020 7123 4567",
      "0113 496 0000",
      "0044 7123 456789",
    ]) {
      expect(await updateProfileAction(null, form({ phone })), phone).toEqual({ ok: true });
    }
  });

  it("stores the number as the mask formatted it", async () => {
    await updateProfileAction(null, form({ phone: "+44 20 7123 4567" }));
    expect((await employeeRepository.findById(ME))?.phone).toBe("+44 20 7123 4567");
  });

  it("lets an optional field stay empty", async () => {
    expect(
      await updateProfileAction(null, form({ phone: "", lastName: "", address: "" })),
    ).toEqual({ ok: true });
  });

  it("rejects a birth date that cannot belong to an employee", async () => {
    // A year typed as this year is the typo the rule exists to catch.
    for (const birthDate of ["2026-08-01", "2030-01-01", "1850-01-01"]) {
      expect(await updateProfileAction(null, form({ birthDate })), birthDate).toEqual({
        ok: false,
        error: "invalidBirthDate",
      });
    }
  });

  it("accepts a plausible birth date", async () => {
    expect(await updateProfileAction(null, form({ birthDate: "1996-04-02" }))).toEqual({
      ok: true,
    });
  });

  it("refuses a value past its maximum length, which only a crafted POST reaches", async () => {
    expect(await updateProfileAction(null, form({ address: "x".repeat(201) }))).toEqual({
      ok: false,
      error: "valueTooLong",
    });
    expect(await updateProfileAction(null, form({ firstName: "x".repeat(41) }))).toEqual({
      ok: false,
      error: "valueTooLong",
    });
  });
});

describe("changing a password", () => {
  it("replaces the hash when the current password is proved", async () => {
    expect(await changePasswordAction(null, passwordForm())).toEqual({ ok: true });

    const account = await userRepository.findByEmployeeId(ME);
    expect(await compare("brandnewpw1", account!.passwordHash)).toBe(true);
    expect(await compare(PASSWORD, account!.passwordHash)).toBe(false);
  });

  it("requires the current password", async () => {
    expect(await changePasswordAction(null, passwordForm({ currentPassword: "" }))).toEqual(
      { ok: false, error: "currentPasswordRequired" },
    );
  });

  it("rejects a wrong current password", async () => {
    expect(
      await changePasswordAction(null, passwordForm({ currentPassword: "wrongpw123" })),
    ).toEqual({ ok: false, error: "wrongPassword" });
  });

  it("rejects a new password under the minimum", async () => {
    expect(
      await changePasswordAction(
        null,
        passwordForm({ newPassword: "short", confirmPassword: "short" }),
      ),
    ).toEqual({ ok: false, error: "passwordTooShort" });
  });

  it("rejects a password past bcrypt's 72-byte ceiling", async () => {
    // Counted in bytes, not characters: 40 two-byte characters is 80 bytes, and
    // bcrypt would have silently ignored everything after the 72nd.
    const long = "ş".repeat(40);
    expect(new TextEncoder().encode(long).length).toBeGreaterThan(72);

    expect(
      await changePasswordAction(
        null,
        passwordForm({ newPassword: long, confirmPassword: long }),
      ),
    ).toEqual({ ok: false, error: "passwordTooLong" });
  });

  it("rejects a mistyped confirmation", async () => {
    expect(
      await changePasswordAction(null, passwordForm({ confirmPassword: "brandnewpw2" })),
    ).toEqual({ ok: false, error: "passwordMismatch" });
  });

  it("checks the confirmation before the old password, so a typo costs nothing", async () => {
    const result = await changePasswordAction(
      null,
      passwordForm({ currentPassword: "wrongpw123", confirmPassword: "mismatch1" }),
    );

    expect(result).toEqual({ ok: false, error: "passwordMismatch" });
  });

  it("refuses to set the password that is already in use", async () => {
    expect(
      await changePasswordAction(
        null,
        passwordForm({ newPassword: PASSWORD, confirmPassword: PASSWORD }),
      ),
    ).toEqual({ ok: false, error: "passwordUnchanged" });
  });

  it("says so when the account has no sign-in at all", async () => {
    await prisma.user.deleteMany({ where: { employeeId: ME } });

    expect(await changePasswordAction(null, passwordForm())).toEqual({
      ok: false,
      error: "noAccount",
    });
  });

  it("leaves the address on the login alone", async () => {
    await changePasswordAction(null, passwordForm());

    const account = await userRepository.findByEmployeeId(ME);
    expect(account?.email).toBe("me@example.test");
  });

  it("writes nothing when the caller is not signed in", async () => {
    assertAuthenticated.mockImplementation(async () => {
      throw new AuthorizationError("unauthenticated");
    });

    expect(await changePasswordAction(null, passwordForm())).toEqual({
      ok: false,
      error: "unauthenticated",
    });
    const account = await userRepository.findByEmployeeId(ME);
    expect(await compare(PASSWORD, account!.passwordHash)).toBe(true);
  });
});

describe("the two actions cannot reach into each other", () => {
  it("does not let a profile save change the password", async () => {
    // Every password key the old combined form posted, on the profile action.
    await updateProfileAction(
      null,
      form({
        currentPassword: PASSWORD,
        newPassword: "brandnewpw1",
        confirmPassword: "brandnewpw1",
      }),
    );

    const account = await userRepository.findByEmployeeId(ME);
    expect(await compare(PASSWORD, account!.passwordHash)).toBe(true);
    expect(await compare("brandnewpw1", account!.passwordHash)).toBe(false);
  });

  it("does not let a password change edit contact details", async () => {
    const before = await employeeRepository.findById(ME);

    const data = passwordForm();
    data.set("firstName", "Hacker");
    data.set("email", "hacker@example.test");
    data.set("phone", "+90 000 000 0000");
    expect(await changePasswordAction(null, data)).toEqual({ ok: true });

    const after = await employeeRepository.findById(ME);
    expect(after?.firstName).toBe(before?.firstName);
    expect(after?.email).toBe(before?.email);
    expect(after?.phone).toBe(before?.phone);
  });

  it("does not need a name to change a password", async () => {
    // The bug the split exists to prevent: a password-only submit arriving with
    // no `firstName` and failing as `nameRequired`.
    expect(await changePasswordAction(null, passwordForm())).toEqual({ ok: true });
  });
});

describe("email and sign-in stay in step", () => {
  it("moves the login when the address changes", async () => {
    expect(
      await updateProfileAction(null, form({ email: "new@example.test" })),
    ).toEqual({ ok: true });

    expect(await userRepository.findByEmail("new@example.test")).not.toBeNull();
    expect(await userRepository.findByEmail("me@example.test")).toBeNull();
    expect((await employeeRepository.findById(ME))?.email).toBe("new@example.test");
  });
});

describe("authorization is unchanged", () => {
  it("writes nothing when the caller is not signed in", async () => {
    assertAuthenticated.mockImplementation(async () => {
      throw new AuthorizationError("unauthenticated");
    });

    expect(await updateProfileAction(null, form({ firstName: "Hacker" }))).toEqual({
      ok: false,
      error: "unauthenticated",
    });
    expect((await employeeRepository.findById(ME))?.firstName).toBe("Me");
  });
});
