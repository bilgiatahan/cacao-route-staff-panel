/**
 * Typed authorisation errors (R6).
 *
 * The guards in `server/auth/session.ts` used to `throw new Error("FORBIDDEN")`
 * and `toActionResult` recovered it with `error.message === "FORBIDDEN"`.
 * Neither end was checked by the compiler, so a typo silently downgraded a
 * permission failure to "unexpected", and any unrelated `Error` carrying that
 * message was silently promoted into one.
 *
 * Two layers are covered: the mapping itself as a pure unit, and a real Server
 * Action boundary end to end.
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

const assertAdmin = vi.fn(async () => ADMIN);
const assertAuthenticated = vi.fn(async () => ADMIN);
vi.mock("@/server/auth/session", () => ({
  assertAdmin: () => assertAdmin(),
  assertAuthenticated: () => assertAuthenticated(),
}));

const { toActionResult, actionErrorMessage } = await import(
  "@/server/actions/action-result"
);
const { decideSwapAction } = await import("@/server/actions/swap.actions");
const { prisma } = await import("@/server/db/client");
const { getDictionary } = await import("@/lib/i18n");
const {
  MONDAY,
  countNotifications,
  createEmployee,
  createPendingSwap,
  createShift,
  resetDatabase,
  shiftOwnerOn,
  swapStatusOf,
} = await import("./support/fixtures");

const REQUESTER = "emp-requester";
const TARGET = "emp-target";
const SWAP = "swap-auth-1";

describe("AuthorizationError", () => {
  it("carries the kind as a typed property", () => {
    expect(new AuthorizationError("forbidden").kind).toBe("forbidden");
    expect(new AuthorizationError("unauthenticated").kind).toBe("unauthenticated");
  });

  it("keeps message populated, as the string version did", () => {
    // Anything that logs the error should read the same as before.
    expect(new AuthorizationError("forbidden").message).toBe("forbidden");
    expect(new AuthorizationError("forbidden")).toBeInstanceOf(Error);
  });
});

describe("toActionResult", () => {
  it("maps forbidden", () => {
    expect(toActionResult(new AuthorizationError("forbidden"))).toEqual({
      ok: false,
      error: "forbidden",
    });
  });

  it("maps unauthenticated", () => {
    expect(toActionResult(new AuthorizationError("unauthenticated"))).toEqual({
      ok: false,
      error: "unauthenticated",
    });
  });

  it("no longer honours the old magic strings", () => {
    // The whole point of R6: a bare Error is not an authorisation failure, so
    // it must not be reported as one however its message reads.
    expect(toActionResult(new Error("FORBIDDEN"))).toEqual({
      ok: false,
      error: "unexpected",
    });
    expect(toActionResult(new Error("UNAUTHENTICATED"))).toEqual({
      ok: false,
      error: "unexpected",
    });
  });

  it("maps every unrelated failure to unexpected, as before", () => {
    for (const thrown of [
      new Error("DATABASE_URL is not set"),
      new TypeError("boom"),
      "a bare string",
      null,
      undefined,
      { kind: "forbidden" }, // shape-alike, but not the class
    ]) {
      expect(toActionResult(thrown)).toEqual({ ok: false, error: "unexpected" });
    }
  });
});

describe("user-facing wording is unchanged", () => {
  it("still renders the generic auth message for both kinds", () => {
    for (const locale of ["tr", "en"] as const) {
      const dict = getDictionary(locale);
      expect(actionErrorMessage("forbidden", dict)).toBe(dict.auth.unexpected);
      expect(actionErrorMessage("unauthenticated", dict)).toBe(dict.auth.unexpected);
    }
  });
});

describe("at a real action boundary", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    assertAdmin.mockImplementation(async () => ADMIN);
    await resetDatabase();
    await createEmployee("emp-admin", "Admin", { role: "admin", sortOrder: 0 });
    await createEmployee(REQUESTER, "Requester", { sortOrder: 1 });
    await createEmployee(TARGET, "Target", { sortOrder: 2 });
    await createShift(REQUESTER, MONDAY);
    await createPendingSwap(SWAP, REQUESTER, TARGET, MONDAY);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("reports forbidden and writes nothing when the caller is not an admin", async () => {
    assertAdmin.mockImplementation(async () => {
      throw new AuthorizationError("forbidden");
    });

    const result = await decideSwapAction(SWAP, "approved");

    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(await swapStatusOf(SWAP)).toBe("pending");
    expect(await shiftOwnerOn(MONDAY, TARGET)).toBeNull();
    expect(await countNotifications()).toBe(0);
  });

  it("reports unauthenticated and writes nothing when there is no session", async () => {
    assertAdmin.mockImplementation(async () => {
      throw new AuthorizationError("unauthenticated");
    });

    const result = await decideSwapAction(SWAP, "approved");

    expect(result).toEqual({ ok: false, error: "unauthenticated" });
    expect(await swapStatusOf(SWAP)).toBe("pending");
    expect(await shiftOwnerOn(MONDAY, TARGET)).toBeNull();
    expect(await countNotifications()).toBe(0);
  });

  it("leaves allowed access working exactly as before", async () => {
    const result = await decideSwapAction(SWAP, "approved");

    expect(result).toEqual({ ok: true });
    expect(await swapStatusOf(SWAP)).toBe("approved");
    expect(await shiftOwnerOn(MONDAY, TARGET)).not.toBeNull();
    expect(await countNotifications()).toBe(1);
  });

  it("still reports rejection as allowed for an admin", async () => {
    const result = await decideSwapAction(SWAP, "rejected");

    expect(result).toEqual({ ok: true });
    expect(await swapStatusOf(SWAP)).toBe("rejected");
  });

  it("does not mistake an unrelated failure for a permission problem", async () => {
    assertAdmin.mockImplementation(async () => {
      throw new Error("connection terminated unexpectedly");
    });

    const result = await decideSwapAction(SWAP, "approved");

    expect(result).toEqual({ ok: false, error: "unexpected" });
    expect(await swapStatusOf(SWAP)).toBe("pending");
  });
});
