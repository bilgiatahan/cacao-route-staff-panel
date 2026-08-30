import { ROUTES } from "@/lib/routes";

/**
 * The two rules every primary navigation surface has to agree on.
 *
 * They were inline in `BottomNav` and correct there. Once the desktop `SideNav`
 * needed the same two behaviours, leaving them inline would have meant two
 * copies that look identical until one of them is edited — and the resulting
 * bug (a tab that loses your week, or a section that stops lighting up on its
 * own detail page) is quiet enough to ship.
 *
 * Deliberately pure string functions: no React, no `IconName`, no component
 * imports, so both navs can hold them without a cycle. `ROUTES` is the one
 * import, and it is a table of strings.
 */

/** `/team/emp-3` is inside `/team`; `/teamwork` is not. */
function isInSection(pathname: string, section: string): boolean {
  return pathname === section || pathname.startsWith(`${section}/`);
}

/** Nested routes count as their section: `/team/emp-3` keeps Team lit. */
export function isNavItemActive(pathname: string, href: string): boolean {
  return isInSection(pathname, href);
}

/**
 * The two sections that are week-scoped — the two that show a week switcher.
 *
 * The rule is "the week travels only where the user can see and change it".
 * Everywhere else it was invisible state: `/team` and `/leave` read the param
 * and quietly rendered a different week's hours, pay and swap options with
 * nothing on screen saying so, and no control to undo it. They now always show
 * the week you are in.
 *
 * `/reports` is absent for a different reason: it accepts a `week` param, but
 * there the value selects a week *inside the month being reported on*, so a
 * roster week arriving from the sidebar is a different question wearing the same
 * name — at best ignored, at worst selecting a boundary week nobody asked for.
 * `/notifications` and `/profile` never look at it at all.
 */
const WEEK_SCOPED_SECTIONS: readonly string[] = [ROUTES.summary, ROUTES.timetable];

/**
 * Switching destinations keeps the selected week — but only where the week means
 * something.
 *
 * It used to be appended to every nav link, which put `?week=2026-07-13` in the
 * address bar of Notifications and Profile, screens with no week at all. A query
 * string that no page reads is not harmless: it is what the user copies, what
 * they bookmark, and what they reasonably read as "this page is showing me that
 * week".
 */
export function navHref(href: string, week: string | null): string {
  if (!week) return href;
  const carriesWeek = WEEK_SCOPED_SECTIONS.some((section) => isInSection(href, section));
  return carriesWeek ? `${href}?week=${week}` : href;
}
