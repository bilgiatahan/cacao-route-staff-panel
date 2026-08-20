/**
 * Profile screen behaviour, pinned before and after the migration.
 *
 * The migration was presentational — primitives replacing hand-rolled markup —
 * so the point of these tests is that nothing underneath moved. The most
 * valuable one is the read-only guarantee: the work-details card claims the
 * manager owns position, contract, wage and leave balance, and this proves the
 * self-service action cannot touch them however the form is posted.
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

const { updateProfileAction } = await import("@/server/actions/profile.actions");
const { employeeRepository } = await import(
  "@/server/repositories/employee.repository"
);
const { userRepository } = await import("@/server/repositories/user.repository");
const { prisma } = await import("@/server/db/client");
const { createEmployee, resetDatabase } = await import("./support/fixtures");
const { hash, compare } = await import("bcryptjs");

const PASSWORD = "currentpw123";
let passwordHash = "";

/** The fields the form posts, with sensible defaults. */
function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const base: Record<string, string> = {
    firstName: "Me",
    lastName: "Test",
    birthDate: "",
    phone: "0555",
    email: "me@example.test",
    address: "Kadikoy",
    currentPassword: "",
    newPassword: "",
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
        phone: "0555111",
        address: "Moda",
        birthDate: "1996-04-02",
      }),
    );

    expect(result).toEqual({ ok: true });
    const after = await employeeRepository.findById(ME);
    expect(after?.firstName).toBe("Ayse");
    expect(after?.lastName).toBe("Yilmaz");
    expect(after?.phone).toBe("0555111");
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

describe("password change", () => {
  it("requires the current password", async () => {
    expect(
      await updateProfileAction(null, form({ newPassword: "brandnewpw1" })),
    ).toEqual({ ok: false, error: "currentPasswordRequired" });
  });

  it("rejects a wrong current password", async () => {
    expect(
      await updateProfileAction(
        null,
        form({ currentPassword: "wrongpw123", newPassword: "brandnewpw1" }),
      ),
    ).toEqual({ ok: false, error: "wrongPassword" });
  });

  it("rejects a new password under the minimum", async () => {
    expect(
      await updateProfileAction(
        null,
        form({ currentPassword: PASSWORD, newPassword: "short" }),
      ),
    ).toEqual({ ok: false, error: "passwordTooShort" });
  });

  it("replaces the hash when the current password is proved", async () => {
    const result = await updateProfileAction(
      null,
      form({ currentPassword: PASSWORD, newPassword: "brandnewpw1" }),
    );

    expect(result).toEqual({ ok: true });
    const account = await userRepository.findByEmployeeId(ME);
    expect(await compare("brandnewpw1", account!.passwordHash)).toBe(true);
    expect(await compare(PASSWORD, account!.passwordHash)).toBe(false);
  });

  it("leaves the password alone when both boxes are blank", async () => {
    expect(await updateProfileAction(null, form({ firstName: "Ayse" }))).toEqual({
      ok: true,
    });
    const account = await userRepository.findByEmployeeId(ME);
    expect(await compare(PASSWORD, account!.passwordHash)).toBe(true);
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
