/**
 * Step 4: the app shell.
 *
 * The shell's behaviour that can be verified without a DOM harness is the part
 * that actually caused bugs: which destination counts as active for a given
 * pathname, and that the four primary destinations are the four routes the
 * information architecture names — in order.
 *
 * `BottomNav` derives `active` as `pathname === href || pathname.startsWith(href + "/")`.
 * That predicate is reproduced here rather than imported, because it lives
 * inside a client component with no DOM test harness in this project; the tests
 * pin the contract the component is written against, including the prefix
 * collisions it must not have.
 */

import { describe, expect, it } from "vitest";

import { navHref } from "@/lib/nav";
import { ROUTES, PROTECTED_PREFIXES, panelHref } from "@/lib/routes";
import { getDictionary } from "@/lib/i18n";

/** The predicate `BottomNav` uses for `aria-current="page"`. */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The canonical order, as built in `(panel)/layout.tsx`. */
const PRIMARY = [ROUTES.summary, ROUTES.timetable, ROUTES.leave, ROUTES.team];

describe("primary destinations", () => {
  it("is exactly four, in the documented order", () => {
    expect(PRIMARY).toEqual(["/summary", "/timetable", "/leave", "/team"]);
  });

  it("does not include notifications or profile", () => {
    // Notifications belong to the header bell, profile to the drawer.
    expect(PRIMARY).not.toContain(ROUTES.notifications);
    expect(PRIMARY).not.toContain(ROUTES.profile);
  });

  it("keeps every primary destination behind the auth guard", () => {
    for (const href of PRIMARY) {
      expect(PROTECTED_PREFIXES).toContain(href);
    }
  });

  it("has a label for each tab in both locales", () => {
    for (const locale of ["tr", "en"] as const) {
      const { nav } = getDictionary(locale);
      for (const label of [nav.summary, nav.timetable, nav.leave, nav.team, nav.pay]) {
        expect(label).toBeTruthy();
      }
    }
  });
});

describe("active-route detection", () => {
  it("lights the exact route", () => {
    for (const href of PRIMARY) {
      expect(isActive(href, href)).toBe(true);
    }
  });

  it("lights a section for its nested routes", () => {
    // The bug this guards: /team/emp-3 and /team/new must keep Payroll lit.
    expect(isActive("/team/emp-3", ROUTES.team)).toBe(true);
    expect(isActive(ROUTES.teamNew, ROUTES.team)).toBe(true);
    expect(isActive(ROUTES.teamMember("emp-9"), ROUTES.team)).toBe(true);
  });

  it("lights exactly one destination for any panel route", () => {
    const routes = [
      ROUTES.summary,
      ROUTES.timetable,
      ROUTES.leave,
      ROUTES.team,
      ROUTES.teamNew,
      ROUTES.teamMember("emp-1"),
    ];
    for (const pathname of routes) {
      const lit = PRIMARY.filter((href) => isActive(pathname, href));
      expect(lit, pathname).toHaveLength(1);
    }
  });

  it("lights nothing for the secondary destinations", () => {
    for (const pathname of [ROUTES.notifications, ROUTES.profile, ROUTES.login]) {
      expect(PRIMARY.filter((href) => isActive(pathname, href))).toHaveLength(0);
    }
  });

  it("has no prefix collisions between destinations", () => {
    // /team must not light because the pathname is /teamwork.
    for (const a of PRIMARY) {
      for (const b of PRIMARY) {
        if (a === b) continue;
        expect(isActive(a, b), `${a} vs ${b}`).toBe(false);
      }
    }
    expect(isActive("/teamwork", ROUTES.team)).toBe(false);
    expect(isActive("/summary-archive", ROUTES.summary)).toBe(false);
  });
});

describe("URL-driven state survives a tab switch", () => {
  it("carries the week onto another destination", () => {
    // BottomNav appends only `?week=`; the target screen re-resolves the rest.
    expect(panelHref(ROUTES.leave, { week: "2026-08-03" })).toBe(
      "/leave?week=2026-08-03",
    );
  });

  it("carries the week to the two screens that show a week switcher", () => {
    for (const href of [ROUTES.summary, ROUTES.timetable]) {
      expect(navHref(href, "2026-08-03"), href).toBe(`${href}?week=2026-08-03`);
    }
  });

  it("does not push the week onto screens that never read it", () => {
    // The bug: `?week=2026-08-03` appeared in the address bar of Notifications
    // and Profile, which have no week — a query string the user copies and
    // bookmarks, saying nothing about what is on screen.
    for (const href of [ROUTES.notifications, ROUTES.profile]) {
      expect(navHref(href, "2026-08-03"), href).toBe(href);
    }
  });

  it("does not push a roster week onto the monthly report", () => {
    // `/reports` reads `?week=` too, but there it selects a week *inside the
    // month being reported on*. Same name, different question.
    expect(navHref(ROUTES.reports, "2026-08-03")).toBe(ROUTES.reports);
  });

  it("does not push the week onto Team or Leave", () => {
    // Both used to read it and render a different week's figures with nothing
    // on screen saying so and no control to change it back. The week now
    // travels only where the user can see and steer it.
    for (const href of [ROUTES.team, ROUTES.teamNew, ROUTES.teamMember("emp-3"), ROUTES.leave]) {
      expect(navHref(href, "2026-08-03"), href).toBe(href);
    }
  });

  it("carries the week into a nested route of a week-scoped section", () => {
    // Not a real route today; the rule is the section, not an exact match, so a
    // future /timetable/… detail page keeps the week without a second edit.
    expect(navHref(`${ROUTES.timetable}/x`, "2026-08-03")).toBe(
      "/timetable/x?week=2026-08-03",
    );
  });

  it("produces a bare path when there is no week, everywhere", () => {
    for (const href of [...PRIMARY, ROUTES.notifications, ROUTES.reports]) {
      expect(navHref(href, null), href).toBe(href);
    }
  });

  it("does not mistake a prefix collision for a week-scoped section", () => {
    expect(navHref("/summary-archive", "2026-08-03")).toBe("/summary-archive");
  });

  it("produces a bare path when there is no week", () => {
    expect(panelHref(ROUTES.summary)).toBe("/summary");
  });

  it("leaves the existing route table untouched", () => {
    // Step 4 reordered the tabs; it must not have renamed a URL.
    expect(ROUTES.summary).toBe("/summary");
    expect(ROUTES.timetable).toBe("/timetable");
    expect(ROUTES.leave).toBe("/leave");
    expect(ROUTES.team).toBe("/team");
    expect(ROUTES.notifications).toBe("/notifications");
    expect(ROUTES.profile).toBe("/profile");
    expect(ROUTES.login).toBe("/login");
    expect(ROUTES.teamNew).toBe("/team/new");
    expect(ROUTES.teamMember("emp-1")).toBe("/team/emp-1");
  });
});

describe("drawer holds only secondary destinations", () => {
  it("offers profile, and does not repeat a primary tab", () => {
    // `AppHeader` builds the entry list; the dictionary is the observable part.
    for (const locale of ["tr", "en"] as const) {
      const { menu } = getDictionary(locale);
      expect(menu.profile).toBeTruthy();
      expect(menu.language).toBeTruthy();
      expect(menu.signOut).toBeTruthy();
      // The rows that linked nowhere are gone, so their strings are too.
      expect(menu).not.toHaveProperty("summary");
      expect(menu).not.toHaveProperty("soon");
      expect(menu).not.toHaveProperty("workDetails");
      expect(menu).not.toHaveProperty("support");
      expect(menu).not.toHaveProperty("privacy");
      expect(menu).not.toHaveProperty("close");
    }
  });

  it("has an unread sentence for the bell badge", () => {
    for (const locale of ["tr", "en"] as const) {
      expect(getDictionary(locale).notifications.unread).toBeTruthy();
    }
  });
});
