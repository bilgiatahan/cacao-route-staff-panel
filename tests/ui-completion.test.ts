/**
 * The final UI completion pass: one bug, four accessibility fixes, one
 * responsive fix.
 *
 * Most of what changed is markup, and this project has no DOM test harness. So
 * these assert the parts that are assertable — the notification action still
 * behaves, the shell's width classes are what the roster needs, the focus trap's
 * exported contract exists, and the roster's semantics and data are intact — and
 * the source is checked directly where only the source can answer.
 */

import { readFileSync } from "node:fs";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/types/domain";

const STAFF: SessionUser = {
  userId: "u-staff",
  employeeId: "emp-staff",
  email: "s@example.test",
  role: "staff",
  fullName: "Staff Test",
};

vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const assertAuthenticated = vi.fn(async () => STAFF);
vi.mock("@/server/auth/session", () => ({
  assertAdmin: () => assertAuthenticated(),
  assertAuthenticated: () => assertAuthenticated(),
}));

const { markNotificationReadAction, markAllNotificationsReadAction } = await import(
  "@/server/actions/notification.actions"
);
const { notificationRepository } = await import(
  "@/server/repositories/notification.repository"
);
const { buildRosterRows } = await import(
  "@/components/features/timetable/view-model"
);
const { getRosterWeek } = await import("@/server/services/roster.service");
const { getDictionary } = await import("@/lib/i18n");
const { prisma } = await import("@/server/db/client");
const { MONDAY, createEmployee, createShift, resetDatabase } = await import(
  "./support/fixtures"
);

const read = (path: string) => readFileSync(path, "utf8");

beforeEach(async () => {
  vi.clearAllMocks();
  assertAuthenticated.mockImplementation(async () => STAFF);
  await resetDatabase();
  await createEmployee("emp-staff", "Staff", { sortOrder: 0 });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("B1 — notification pending is scoped to one row", () => {
  it("tracks the busy id instead of wiring shared pending to every row", () => {
    const src = read("src/components/features/notifications/NotificationList.tsx");
    // The regression was `disabled={item.read || pending}` on every row.
    expect(src).not.toContain("disabled={item.read || pending}");
    expect(src).toContain("busyId");
    expect(src).toContain("disabled={item.read || busy}");
    expect(src).toContain("pending && busyId === item.id");
  });

  it("still marks a single notification read", async () => {
    await notificationRepository.create({
      title: { tr: "a", en: "a" },
      body: { tr: "b", en: "b" },
      audience: { kind: "all" },
    });
    const [note] = await notificationRepository.listForViewer(STAFF);

    expect(await markNotificationReadAction(note.id)).toEqual({ ok: true });
    expect(await notificationRepository.countUnread(STAFF)).toBe(0);
  });

  it("leaves mark-all behaviour untouched", async () => {
    for (const n of [1, 2, 3]) {
      await notificationRepository.create({
        title: { tr: `t${n}`, en: `t${n}` },
        body: { tr: "b", en: "b" },
        audience: { kind: "all" },
      });
    }
    expect(await notificationRepository.countUnread(STAFF)).toBe(3);

    expect(await markAllNotificationsReadAction()).toEqual({ ok: true });
    expect(await notificationRepository.countUnread(STAFF)).toBe(0);
  });
});

describe("A1 — the four sub-44px controls", () => {
  const controls: Array<[string, string]> = [
    ["src/components/features/notifications/MarkAllReadButton.tsx", "min-h-11"],
    ["src/app/(panel)/team/new/page.tsx", "min-h-11"],
    ["src/app/(panel)/team/[employeeId]/page.tsx", "min-h-11"],
    ["src/app/login/page.tsx", "min-h-11"],
  ];

  it("each now declares a 44px minimum", () => {
    for (const [path, token] of controls) {
      expect(read(path), path).toContain(token);
    }
  });

  it("no longer uses the 29px padding they shared", () => {
    for (const [path] of controls) {
      expect(read(path), path).not.toContain("py-[7px]");
    }
  });
});

describe("A2 — roster grid semantics", () => {
  const src = read("src/components/features/timetable/RosterBoard.tsx");

  it("declares grid, row, columnheader, rowheader and gridcell", () => {
    for (const role of ["grid", "row", "columnheader", "rowheader", "gridcell"]) {
      expect(src, role).toContain(`role="${role}"`);
    }
  });

  it("reports its own dimensions", () => {
    expect(src).toContain("aria-rowcount");
    expect(src).toContain("aria-colcount");
  });

  it("keeps the button role for editable cells", () => {
    // `display: contents` carries the gridcell so the button survives.
    expect(src).toContain('role="gridcell" className="contents"');
    expect(src).toContain('type="button"');
  });

  it("still labels every cell with its state", () => {
    expect(src).toContain("aria-label={cellLabel}");
    expect(src).toContain("cell.stateLabel");
  });

  it("finally renders the staffColumn label that was passed and ignored", () => {
    expect(src).toContain("{staffColumn}");
  });

  it("leaves the roster data untouched", async () => {
    await createShift("emp-staff", MONDAY, 9 * 60, 17 * 60);
    const dict = getDictionary("en");
    const roster = await getRosterWeek(MONDAY);
    const rows = buildRosterRows(roster.rows, dict, "en");

    expect(rows).toHaveLength(1);
    expect(rows[0].cells).toHaveLength(7);
    const worked = rows[0].cells.find((c) => c.state === "shift")!;
    expect(worked.stateLabel).toBe("09:00–17:00");
    expect(rows[0].cells.find((c) => c.state === "off")!.primary).toBe("–");
  });
});

describe("A3 — focus trap", () => {
  const trap = read("src/components/ui/use-focus-trap.ts");

  it("wraps in both directions", () => {
    expect(trap).toContain("event.shiftKey");
    expect(trap).toContain("last.focus()");
    expect(trap).toContain("first.focus()");
  });

  it("excludes tabindex -1 from the tab order", () => {
    expect(trap).toContain('[tabindex]:not([tabindex="-1"])');
  });

  it("is used by both overlays", () => {
    for (const path of [
      "src/components/ui/Sheet.tsx",
      "src/components/layout/AppMenu.tsx",
    ]) {
      expect(read(path), path).toContain("useFocusTrap(panelRef, open)");
    }
  });

  it("leaves Escape and focus restoration where they were", () => {
    const sheet = read("src/components/ui/Sheet.tsx");
    const menu = read("src/components/layout/AppMenu.tsx");
    expect(sheet).toContain('event.key === "Escape"');
    expect(menu).toContain('event.key === "Escape"');
    // The drawer still returns focus to the trigger it came from.
    expect(menu).toContain("trigger?.focus()");
  });
});

describe("A4 — icon size floor", () => {
  it("has no icon under 16px left in the shared components", () => {
    for (const path of [
      "src/components/ui/Section.tsx",
      "src/components/layout/AppMenu.tsx",
    ]) {
      const src = read(path);
      expect(src, path).not.toContain("h-4.25");
      expect(src, path).not.toContain("h-3.5 w-3.5");
    }
  });
});

describe("C1 — the roster gets its width from the tablet breakpoint", () => {
  // Assembled rather than written out: Tailwind scans this directory, and a bare
  // class literal here makes it emit the very utility being asserted against.
  const LG_SHELL = ["lg", "max-w-shell"].join(":");
  const MD_SHELL = ["md", "max-w-shell"].join(":");

  it("widens the frame at md, not lg", () => {
    const layout = read("src/app/(panel)/layout.tsx");
    expect(layout).toContain(MD_SHELL);
    expect(layout).not.toContain(LG_SHELL);
  });

  it("moves PageShell's wide variant to the same breakpoint", () => {
    const shell = read("src/components/layout/PageShell.tsx");
    expect(shell).toContain(MD_SHELL);
    expect(shell).not.toContain(LG_SHELL);
  });

  it("keeps narrow narrow", () => {
    const shell = read("src/components/layout/PageShell.tsx");
    expect(shell).toContain('narrow: "max-w-panel"');
  });

  it("leaves the four narrow screens narrow", () => {
    for (const path of [
      "src/app/(panel)/profile/page.tsx",
      "src/app/(panel)/summary/page.tsx",
      "src/app/(panel)/leave/page.tsx",
      "src/app/(panel)/team/page.tsx",
    ]) {
      // JSX usage, not a docblock that merely mentions the option.
      expect(read(path), path).not.toContain('<PageShell width="wide">');
    }
  });

  it("leaves the roster the only wide screen", () => {
    expect(read("src/app/(panel)/timetable/page.tsx")).toContain(
      '<PageShell width="wide">',
    );
  });

  it("preserves the mobile scroll container", () => {
    const src = read("src/components/features/timetable/RosterBoard.tsx");
    expect(src).toContain("overflow-x-auto");
    expect(src).toContain("min-w-117.5");
  });
});
