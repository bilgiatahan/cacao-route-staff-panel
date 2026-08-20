/**
 * Step 2: no action result may be discarded.
 *
 * Six actions triggered by a bare button used to `await` an `ActionResult` and
 * throw it away, so a failure looked exactly like success. These tests pin the
 * contract the UI now depends on: every failing action returns a key that maps
 * to a real sentence in both locales, and every success path still returns ok.
 *
 * The rendering of that sentence is a client concern; what is verifiable here is
 * that the key exists, is localised, and is produced on the paths that failed
 * silently before.
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
const STAFF: SessionUser = { ...ADMIN, employeeId: "emp-staff", role: "staff" };

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
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

const { actionErrorMessages, actionErrorMessage } = await import(
  "@/server/actions/action-result"
);
const { decideLeaveAction } = await import("@/server/actions/leave.actions");
const { decideSwapAction } = await import("@/server/actions/swap.actions");
const { archiveEmployeeAction } = await import("@/server/actions/employee.actions");
const { clearShiftAction, saveShiftAction } = await import(
  "@/server/actions/shift.actions"
);
const { markNotificationReadAction, markAllNotificationsReadAction } = await import(
  "@/server/actions/notification.actions"
);
const { getDictionary } = await import("@/lib/i18n");
const { prisma } = await import("@/server/db/client");
const {
  MONDAY,
  createEmployee,
  createPendingSwap,
  createShift,
  resetDatabase,
} = await import("./support/fixtures");

const STAFF_ID = "emp-staff";

async function createPendingLeave(id: string, employeeId: string) {
  await prisma.leaveRequest.create({
    data: {
      id,
      employeeId,
      type: "annual",
      startDate: MONDAY,
      endDate: MONDAY,
      note: "",
      status: "pending",
      createdAt: new Date(),
      decidedAt: null,
      decidedByEmployeeId: null,
    },
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  assertAdmin.mockImplementation(async () => ADMIN);
  assertAuthenticated.mockImplementation(async () => ADMIN);
  await resetDatabase();
  await createEmployee("emp-admin", "Admin", { role: "admin", sortOrder: 0 });
  await createEmployee(STAFF_ID, "Staff", { sortOrder: 1 });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("actionErrorMessages", () => {
  it("resolves every key to a non-empty sentence in both locales", () => {
    for (const locale of ["tr", "en"] as const) {
      const messages = actionErrorMessages(getDictionary(locale));
      const keys = Object.keys(messages);
      expect(keys).toContain("forbidden");
      expect(keys).toContain("notFound");
      expect(keys).toContain("unexpected");
      for (const [key, text] of Object.entries(messages)) {
        expect(text, key).toBeTruthy();
        expect(typeof text, key).toBe("string");
      }
    }
  });

  it("agrees with actionErrorMessage for the same key", () => {
    const dict = getDictionary("tr");
    const messages = actionErrorMessages(dict);
    expect(messages.emailTaken).toBe(actionErrorMessage("emailTaken", dict));
    expect(messages.wrongPassword).toBe(actionErrorMessage("wrongPassword", dict));
  });

  it("always has a message for the fallback the hook uses", () => {
    // `useActionFeedback` falls back to `unexpected` for unknown keys and throws.
    for (const locale of ["tr", "en"] as const) {
      expect(actionErrorMessages(getDictionary(locale)).unexpected).toBeTruthy();
    }
  });
});

describe("leave decisions surface failures", () => {
  it("returns notFound for a request that was already decided", async () => {
    await createPendingLeave("leave-1", STAFF_ID);
    expect(await decideLeaveAction("leave-1", "approved")).toEqual({ ok: true });

    const second = await decideLeaveAction("leave-1", "approved");

    expect(second).toEqual({ ok: false, error: "notFound" });
    expect(actionErrorMessages(getDictionary("tr"))[
      (second as { error: "notFound" }).error
    ]).toBeTruthy();
  });

  it("returns forbidden when a non-admin decides", async () => {
    assertAdmin.mockImplementation(async () => {
      throw new AuthorizationError("forbidden");
    });
    await createPendingLeave("leave-1", STAFF_ID);

    expect(await decideLeaveAction("leave-1", "rejected")).toEqual({
      ok: false,
      error: "forbidden",
    });
  });

  it("still succeeds on the happy path", async () => {
    await createPendingLeave("leave-1", STAFF_ID);
    expect(await decideLeaveAction("leave-1", "rejected")).toEqual({ ok: true });
  });
});

describe("swap decisions surface failures", () => {
  it("returns notFound when the shift can no longer be moved", async () => {
    await createPendingSwap("swap-1", STAFF_ID, "emp-admin", MONDAY);

    expect(await decideSwapAction("swap-1", "approved")).toEqual({
      ok: false,
      error: "notFound",
    });
  });

  it("returns forbidden for a non-admin", async () => {
    assertAdmin.mockImplementation(async () => {
      throw new AuthorizationError("forbidden");
    });
    await createShift(STAFF_ID, MONDAY);
    await createPendingSwap("swap-1", STAFF_ID, "emp-admin", MONDAY);

    expect(await decideSwapAction("swap-1", "approved")).toEqual({
      ok: false,
      error: "forbidden",
    });
  });

  it("still succeeds on the happy path", async () => {
    await createShift(STAFF_ID, MONDAY);
    await createPendingSwap("swap-1", STAFF_ID, "emp-admin", MONDAY);
    expect(await decideSwapAction("swap-1", "approved")).toEqual({ ok: true });
  });
});

describe("archive surfaces failures", () => {
  it("returns notFound for an unknown employee", async () => {
    expect(await archiveEmployeeAction("emp-missing")).toEqual({
      ok: false,
      error: "notFound",
    });
  });

  it("returns forbidden when an admin targets themselves", async () => {
    expect(await archiveEmployeeAction("emp-admin")).toEqual({
      ok: false,
      error: "forbidden",
    });
  });

  it("returns forbidden for a non-admin", async () => {
    assertAdmin.mockImplementation(async () => {
      throw new AuthorizationError("forbidden");
    });
    expect(await archiveEmployeeAction(STAFF_ID)).toEqual({
      ok: false,
      error: "forbidden",
    });
  });

  it("still redirects on success", async () => {
    await expect(archiveEmployeeAction(STAFF_ID)).rejects.toThrow(/^REDIRECT:/);
  });
});

describe("shift editor surfaces failures", () => {
  it("clearShiftAction reports forbidden instead of resolving silently", async () => {
    assertAdmin.mockImplementation(async () => {
      throw new AuthorizationError("forbidden");
    });

    expect(await clearShiftAction(STAFF_ID, MONDAY)).toEqual({
      ok: false,
      error: "forbidden",
    });
  });

  it("clearShiftAction reports notFound for a malformed date", async () => {
    expect(await clearShiftAction(STAFF_ID, "not-a-date")).toEqual({
      ok: false,
      error: "notFound",
    });
  });

  it("saveShiftAction distinguishes a permission failure from a bad time", async () => {
    // The editor used to render `invalidTime` for both, so a staff member was
    // told their times were wrong when they simply were not allowed.
    assertAdmin.mockImplementation(async () => {
      throw new AuthorizationError("forbidden");
    });
    const denied = await saveShiftAction({
      employeeId: STAFF_ID,
      date: MONDAY,
      startTime: "09:00",
      endTime: "17:00",
    });
    expect(denied).toEqual({ ok: false, error: "forbidden" });

    assertAdmin.mockImplementation(async () => ADMIN);
    const badTime = await saveShiftAction({
      employeeId: STAFF_ID,
      date: MONDAY,
      startTime: "17:00",
      endTime: "09:00",
    });
    expect(badTime).toEqual({ ok: false, error: "invalidTime" });

    const dict = getDictionary("tr");
    const messages = actionErrorMessages(dict);
    expect(messages.forbidden).not.toBe(messages.invalidTime);
  });

  it("still succeeds on the happy path", async () => {
    expect(
      await saveShiftAction({
        employeeId: STAFF_ID,
        date: MONDAY,
        startTime: "09:00",
        endTime: "17:00",
      }),
    ).toEqual({ ok: true });
  });
});

describe("notification actions surface failures", () => {
  it("markNotificationReadAction reports unauthenticated", async () => {
    assertAuthenticated.mockImplementation(async () => {
      throw new AuthorizationError("unauthenticated");
    });

    expect(await markNotificationReadAction("note-1")).toEqual({
      ok: false,
      error: "unauthenticated",
    });
  });

  it("markAllNotificationsReadAction reports unauthenticated", async () => {
    assertAuthenticated.mockImplementation(async () => {
      throw new AuthorizationError("unauthenticated");
    });

    expect(await markAllNotificationsReadAction()).toEqual({
      ok: false,
      error: "unauthenticated",
    });
  });

  it("still succeeds on the happy path", async () => {
    assertAuthenticated.mockImplementation(async () => STAFF);
    expect(await markAllNotificationsReadAction()).toEqual({ ok: true });
  });
});
