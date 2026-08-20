/**
 * Archive releases the sign-in credential, so the same person can be re-hired.
 *
 * Before: archiving set `archivedAt` and left the `users` row alone. Sign-in
 * already failed (both the credentials provider and `getSessionUser` resolve the
 * employee through `findById`, which filters `archivedAt: null`), so it was not
 * an authorisation hole — but `User.email` is unique, so the address stayed
 * claimed and re-hiring returned `emailTaken` with no in-panel way out.
 *
 * The chosen model is the one the schema already implies: `Employee.email` is
 * indexed but NOT unique while `User.email` is unique, so the personnel record
 * may repeat and the credential may not. Archiving therefore retires the
 * personnel record and releases the credential; re-hiring is just "add person"
 * again. The employee row is never deleted — every history relation cascades on
 * it.
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

vi.mock("next/cache", () => ({ refresh: vi.fn() }));

// `createEmployeeAction` / `archiveEmployeeAction` finish by redirecting, which
// throws by design. Surfaced as a recognisable error so success is assertable.
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const assertAdmin = vi.fn(async () => ADMIN);
const assertAuthenticated = vi.fn(async () => ADMIN);
vi.mock("@/server/auth/session", () => ({
  assertAdmin: () => assertAdmin(),
  assertAuthenticated: () => assertAuthenticated(),
}));

const { archiveEmployeeAction, createEmployeeAction, updateEmployeeAction } =
  await import("@/server/actions/employee.actions");
const { employeeRepository } = await import(
  "@/server/repositories/employee.repository"
);
const { userRepository } = await import("@/server/repositories/user.repository");
const { prisma } = await import("@/server/db/client");
const { MONDAY, createEmployee, createShift, resetDatabase } = await import(
  "./support/fixtures"
);

const LEAVER = "emp-leaver";
const EMAIL = "emp-leaver@example.test";

/** Gives an employee a real login, the way the create form does. */
async function grantLogin(employeeId: string, email: string) {
  await prisma.user.create({
    data: {
      id: `user-${employeeId}`,
      email,
      passwordHash: "$2a$10$notarealhashbutlongenoughtostore",
      employeeId,
    },
  });
}

async function createLeaveFor(id: string, employeeId: string) {
  await prisma.leaveRequest.create({
    data: {
      id,
      employeeId,
      type: "annual",
      startDate: MONDAY,
      endDate: MONDAY,
      note: "",
      status: "approved",
      createdAt: new Date(),
      decidedAt: new Date(),
      decidedByEmployeeId: "emp-admin",
    },
  });
}

/** Form payload matching `readDraft`. */
function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

beforeEach(async () => {
  vi.clearAllMocks();
  assertAdmin.mockImplementation(async () => ADMIN);
  redirect.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
  await resetDatabase();
  await createEmployee("emp-admin", "Admin", { role: "admin", sortOrder: 0 });
  await createEmployee(LEAVER, "Leaver", { sortOrder: 1 });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("archiving an employee", () => {
  it("marks them archived and releases the credential", async () => {
    await grantLogin(LEAVER, EMAIL);

    expect(await employeeRepository.archive(LEAVER)).toBe(true);

    const row = await prisma.employee.findUnique({ where: { id: LEAVER } });
    expect(row?.archivedAt).toBeInstanceOf(Date);
    expect(await userRepository.findByEmail(EMAIL)).toBeNull();
    expect(await prisma.user.count({ where: { employeeId: LEAVER } })).toBe(0);
  });

  it("works for someone who never had a login", async () => {
    expect(await employeeRepository.archive(LEAVER)).toBe(true);
    expect(await prisma.user.count()).toBe(0);
  });

  it("returns false and changes nothing when already archived", async () => {
    await grantLogin(LEAVER, EMAIL);
    await employeeRepository.archive(LEAVER);
    const firstArchivedAt = (
      await prisma.employee.findUnique({ where: { id: LEAVER } })
    )?.archivedAt;

    expect(await employeeRepository.archive(LEAVER)).toBe(false);

    const again = await prisma.employee.findUnique({ where: { id: LEAVER } });
    expect(again?.archivedAt).toEqual(firstArchivedAt);
  });

  it("drops them off the active listings", async () => {
    await employeeRepository.archive(LEAVER);

    const ids = (await employeeRepository.list()).map((e) => e.id);
    const staffIds = (await employeeRepository.listStaff()).map((e) => e.id);
    expect(ids).not.toContain(LEAVER);
    expect(staffIds).not.toContain(LEAVER);
    expect(await employeeRepository.findById(LEAVER)).toBeNull();
  });
});

describe("an archived employee cannot use the panel", () => {
  it("cannot be resolved as an active employee", async () => {
    await grantLogin(LEAVER, EMAIL);
    await employeeRepository.archive(LEAVER);

    // Both the credentials provider and getSessionUser resolve through findById.
    expect(await employeeRepository.findById(LEAVER)).toBeNull();
  });

  it("has no credential left to authenticate with", async () => {
    await grantLogin(LEAVER, EMAIL);
    await employeeRepository.archive(LEAVER);

    // The provider's first step now fails outright, ahead of the employee check.
    expect(await userRepository.findByEmail(EMAIL)).toBeNull();
    expect(await userRepository.findByEmployeeId(LEAVER)).toBeNull();
  });
});

describe("re-hiring the same person", () => {
  it("accepts the released email and builds a fresh employee + login", async () => {
    await grantLogin(LEAVER, EMAIL);
    await employeeRepository.archive(LEAVER);

    await expect(
      createEmployeeAction(
        null,
        form({
          firstName: "Leaver",
          lastName: "Returned",
          email: EMAIL,
          password: "longenoughpw",
          position: "Barista",
          contract: "part",
        }),
      ),
    ).rejects.toThrow(/^REDIRECT:/);

    const rehired = await userRepository.findByEmail(EMAIL);
    expect(rehired).not.toBeNull();
    expect(rehired!.employeeId).not.toBe(LEAVER); // a new personnel record

    const employee = await employeeRepository.findById(rehired!.employeeId);
    expect(employee?.lastName).toBe("Returned");
    expect(employee?.archivedAt).toBeNull();
  });

  it("was genuinely blocked before the credential was released", async () => {
    // Same flow without archiving: the active credential must still win.
    await grantLogin(LEAVER, EMAIL);

    const result = await createEmployeeAction(
      null,
      form({
        firstName: "Impostor",
        email: EMAIL,
        password: "longenoughpw",
        position: "Barista",
        contract: "part",
      }),
    );

    expect(result).toEqual({ ok: false, error: "emailTaken" });
  });

  it("leaves exactly one active holder of the address", async () => {
    await grantLogin(LEAVER, EMAIL);
    await employeeRepository.archive(LEAVER);
    await expect(
      createEmployeeAction(
        null,
        form({
          firstName: "Leaver",
          email: EMAIL,
          password: "longenoughpw",
          position: "Barista",
          contract: "part",
        }),
      ),
    ).rejects.toThrow(/^REDIRECT:/);

    expect(await prisma.user.count({ where: { email: EMAIL } })).toBe(1);
  });
});

describe("history survives archive and re-hire", () => {
  it("keeps shifts and leave attached to the archived employee", async () => {
    await grantLogin(LEAVER, EMAIL);
    await createShift(LEAVER, MONDAY);
    await createLeaveFor("leave-hist", LEAVER);

    await employeeRepository.archive(LEAVER);

    // The employee row is retained precisely so these cascades never fire.
    expect(await prisma.employee.count({ where: { id: LEAVER } })).toBe(1);
    expect(await prisma.shift.count({ where: { employeeId: LEAVER } })).toBe(1);
    expect(
      await prisma.leaveRequest.count({ where: { employeeId: LEAVER } }),
    ).toBe(1);
  });

  it("does not merge old history onto the re-hired record", async () => {
    await grantLogin(LEAVER, EMAIL);
    await createShift(LEAVER, MONDAY);
    await employeeRepository.archive(LEAVER);

    await expect(
      createEmployeeAction(
        null,
        form({
          firstName: "Leaver",
          email: EMAIL,
          password: "longenoughpw",
          position: "Barista",
          contract: "part",
        }),
      ),
    ).rejects.toThrow(/^REDIRECT:/);

    const rehired = (await userRepository.findByEmail(EMAIL))!.employeeId;
    expect(await prisma.shift.count({ where: { employeeId: LEAVER } })).toBe(1);
    expect(await prisma.shift.count({ where: { employeeId: rehired } })).toBe(0);
  });
});

describe("uniqueness for active people is unchanged", () => {
  it("still rejects a second active login on one address", async () => {
    await createEmployee("emp-other", "Other", { sortOrder: 2 });
    await grantLogin("emp-other", EMAIL);

    const result = await createEmployeeAction(
      null,
      form({
        firstName: "Clash",
        email: EMAIL,
        password: "longenoughpw",
        position: "Barista",
        contract: "part",
      }),
    );

    expect(result).toEqual({ ok: false, error: "emailTaken" });
  });

  it("still rejects moving an active login onto someone else's address", async () => {
    await createEmployee("emp-other", "Other", { sortOrder: 2 });
    await grantLogin("emp-other", EMAIL);

    const result = await updateEmployeeAction(
      LEAVER,
      null,
      form({
        firstName: "Leaver",
        email: EMAIL,
        password: "longenoughpw",
        position: "Barista",
        contract: "part",
      }),
    );

    expect(result).toEqual({ ok: false, error: "emailTaken" });
  });
});

describe("archive authorization is unchanged", () => {
  it("refuses a non-admin and archives nothing", async () => {
    assertAdmin.mockImplementation(async () => {
      throw new AuthorizationError("forbidden");
    });
    await grantLogin(LEAVER, EMAIL);

    expect(await archiveEmployeeAction(LEAVER)).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await employeeRepository.findById(LEAVER)).not.toBeNull();
    expect(await userRepository.findByEmail(EMAIL)).not.toBeNull();
  });

  it("still refuses to let an admin archive themselves", async () => {
    await grantLogin("emp-admin", ADMIN.email);

    expect(await archiveEmployeeAction("emp-admin")).toEqual({
      ok: false,
      error: "forbidden",
    });
    // Critically, the admin's own credential must survive that refusal.
    expect(await userRepository.findByEmail(ADMIN.email)).not.toBeNull();
  });

  it("reports notFound for an unknown employee without touching credentials", async () => {
    await grantLogin(LEAVER, EMAIL);

    expect(await archiveEmployeeAction("emp-missing")).toEqual({
      ok: false,
      error: "notFound",
    });
    expect(await userRepository.findByEmail(EMAIL)).not.toBeNull();
  });
});
