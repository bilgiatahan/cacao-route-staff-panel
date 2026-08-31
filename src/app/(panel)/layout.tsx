import { Suspense, type ReactNode } from "react";

import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav, type NavItem } from "@/components/layout/BottomNav";
import { SideNav } from "@/components/layout/SideNav";
import { APP_VERSION } from "@/lib/constants";
import { employeeInitials } from "@/lib/employee";
import { getTranslations } from "@/lib/i18n/server";
import { ROUTES } from "@/lib/routes";
import { requireCurrentEmployee } from "@/server/auth/session";
import { notificationRepository } from "@/server/repositories/notification.repository";
import { getPendingRequests } from "@/server/services/leave.service";
import { canViewPay } from "@/server/services/settings.service";

/**
 * The app shell: a sticky header, the screen, and the four-tab bar.
 *
 * The frame is a 560px column on a phone and widens to 960px from `lg` up. The
 * *content* measure is each screen's own decision, made with `PageShell`, which
 * is why this layout does not impose one: the roster needs all 960px for seven
 * day columns, while a form wants a short line whatever the monitor is.
 *
 * From 1024px the shell swaps rather than stretches. `SideNav` appears, the
 * header and the tab bar go to `display: none`, and the frame stops being a
 * centred column and becomes the workspace. Every one of those changes is an
 * `lg:` utility on top of the mobile class it does not replace, so 0–1023px
 * renders exactly what it rendered before the sidebar existed.
 */
export default async function PanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [{ locale, dict }, { user, employee }] = await Promise.all([
    getTranslations(),
    requireCurrentEmployee(),
  ]);

  const isAdmin = user.role === "admin";

  const [unreadCount, pending, showsPay] = await Promise.all([
    notificationRepository.countUnread(user),
    // Same cached read the admin summary uses, so the badge and the page agree
    // and only one pair of queries goes out.
    isAdmin ? getPendingRequests() : Promise.resolve({ leave: [], swaps: [] }),
    // The pay tab is the payroll screen's only entrance, so the same answer that
    // guards the screen has to decide whether the tab is drawn at all — a tab
    // that bounces you back to Summary is worse than no tab.
    canViewPay(user),
  ]);

  const pendingCount = pending.leave.length + pending.swaps.length;
  // The bell's sentence, built once and given to both the header and the rail.
  const unreadLabel = `${unreadCount} ${dict.notifications.unread}`;

  // Summary, Schedule, Leave, Payroll — the employee's recurring tasks, in the
  // order they are thought about. Notifications stay in the header bell and
  // profile stays in the drawer; neither is a primary workflow.
  //
  // Payroll is the one that can be absent: with pay hidden, staff drop to three
  // tabs rather than getting a fourth that leads nowhere.
  const navItems: NavItem[] = [
    {
      key: "summary",
      href: ROUTES.summary,
      label: dict.nav.summary,
      icon: "layoutDashboard",
      badge: 0,
    },
    {
      key: "timetable",
      href: ROUTES.timetable,
      label: dict.nav.timetable,
      icon: "timetable",
      badge: 0,
    },
    {
      key: "leave",
      href: ROUTES.leave,
      label: dict.nav.leave,
      icon: "leave",
      // The only tab with a count: an admin has decisions waiting. Staff see 0,
      // and `CountBadge` renders nothing at 0.
      badge: pendingCount,
      badgeLabel: `${pendingCount} ${dict.summary.pendingSuffix}`,
    },
    // Team for the admin, Pay for everyone else — and for staff only while the
    // admin has pay visible. The grid tracks `items.length`, so a three-tab bar
    // lays itself out correctly without anything else changing.
    ...(showsPay
      ? [
          {
            key: "team",
            href: ROUTES.team,
            label: isAdmin ? dict.nav.team : dict.nav.pay,
            icon: isAdmin ? ("team" as const) : ("pay" as const),
            badge: 0,
          },
        ]
      : []),
  ];

  // Notifications and Profile are the header bell and the drawer's single row.
  // On a phone they are deliberately not tabs; on a desk there is room to list
  // them without crowding the four that matter, one divider down.
  const secondaryItems: NavItem[] = [
    // Admin-only, and secondary on purpose: the monthly cost report is a
    // management question, not one of the four recurring tasks the tab bar
    // holds. Adding a fifth tab would demote every one of them.
    ...(isAdmin
      ? [
          {
            key: "reports",
            href: ROUTES.reports,
            label: dict.nav.reports,
            icon: "summary" as const,
            badge: 0,
          },
          {
            key: "settings",
            href: ROUTES.settings,
            label: dict.nav.settings,
            icon: "settings" as const,
            badge: 0,
          },
        ]
      : []),
    {
      key: "notifications",
      href: ROUTES.notifications,
      label: dict.nav.notifications,
      icon: "notifications",
      badge: unreadCount,
      badgeLabel: unreadLabel,
    },
    {
      key: "profile",
      href: ROUTES.profile,
      label: dict.menu.profile,
      icon: "user",
      badge: 0,
    },
  ];

  return (
    <div className="flex min-h-dvh justify-center bg-canvas lg:justify-start">
      <Suspense
        // Reserves the rail so the workspace cannot jump sideways on hydration.
        fallback={<div aria-hidden className="hidden w-18 flex-none lg:block xl:w-65" />}
      >
        <SideNav
          items={navItems}
          secondary={secondaryItems}
          brand={{ name: dict.brand.name, panel: dict.brand.panel }}
          profile={{
            name: user.fullName,
            role: user.role === "admin" ? dict.brand.managerTitle : employee.position[locale],
            email: user.email,
            initials: employeeInitials(employee),
          }}
          labels={{
            navigation: dict.brand.panel,
            language: dict.menu.language,
            signOut: dict.menu.signOut,
            version: dict.menu.version,
          }}
          locale={{
            current: locale,
            labels: {
              group: dict.menu.language,
              names: { tr: dict.menu.localeTr, en: dict.menu.localeEn },
            },
          }}
          appVersion={APP_VERSION}
        />
      </Suspense>

      <div className="bg-fill relative flex min-h-dvh w-full max-w-panel flex-col shadow-[0_0_0_1px_var(--color-line)] md:max-w-shell lg:max-w-none lg:flex-1 lg:shadow-none">
        <AppHeader
          dict={dict}
          user={user}
          employee={employee}
          locale={locale}
          unreadCount={unreadCount}
        />
        <main
          id="main"
          className="flex flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-384 lg:bg-fill lg:px-6 xl:px-8"
        >
          {children}
          <div className="h-7" />
        </main>

        <Suspense fallback={<div className="h-14 rounded-t-xl bg-brand lg:hidden" />}>
          <BottomNav items={navItems} />
        </Suspense>
      </div>
    </div>
  );
}
