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
 * imports, so both navs can hold them without a cycle.
 */

/** Nested routes count as their section: `/team/emp-3` keeps Team lit. */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Switching destinations keeps the selected week, so the roster you were
 * looking at is still the one you land on.
 */
export function navHref(href: string, week: string | null): string {
  return week ? `${href}?week=${week}` : href;
}
