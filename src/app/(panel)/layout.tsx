import { Suspense, type ReactNode } from "react";

import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav, type NavItem } from "@/components/layout/BottomNav";
import { getTranslations } from "@/lib/i18n/server";
import { ROUTES } from "@/lib/routes";
import { requireCurrentEmployee } from "@/server/auth/session";
import { notificationRepository } from "@/server/repositories/notification.repository";
import { getPendingRequests } from "@/server/services/leave.service";

/**
 * The app shell: a sticky header, the screen, and the four-tab bar.
 *
 * The frame is a 560px column on a phone and widens to 960px from `lg` up. The
 * *content* measure is each screen's own decision, made with `PageShell`, which
 * is why this layout does not impose one: the roster needs all 960px for seven
 * day columns, while a form wants a short line whatever the monitor is.
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

  const [unreadCount, pending] = await Promise.all([
    notificationRepository.countUnread(user),
    // Same cached read the admin summary uses, so the badge and the page agree
    // and only one pair of queries goes out.
    isAdmin ? getPendingRequests() : Promise.resolve({ leave: [], swaps: [] }),
  ]);

  const pendingCount = pending.leave.length + pending.swaps.length;

  // Summary, Schedule, Leave, Payroll — the employee's four recurring tasks, in
  // the order they are thought about. Notifications stay in the header bell and
  // profile stays in the drawer; neither is a primary workflow.
  const navItems: NavItem[] = [
    {
      key: "summary",
      href: ROUTES.summary,
      label: dict.nav.summary,
      icon: "summary",
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
    {
      key: "team",
      href: ROUTES.team,
      label: isAdmin ? dict.nav.team : dict.nav.pay,
      icon: isAdmin ? "team" : "pay",
      badge: 0,
    },
  ];

  return (
    <div className="flex min-h-dvh justify-center bg-canvas">
      <div className="relative flex min-h-dvh w-full max-w-panel flex-col shadow-[0_0_0_1px_var(--color-line)] md:max-w-shell">
        <AppHeader
          dict={dict}
          user={user}
          employee={employee}
          locale={locale}
          unreadCount={unreadCount}
        />
        <main className="flex flex-1 flex-col">
          {children}
          <div className="h-7" />
        </main>

        <Suspense fallback={<div className="h-14 rounded-t-xl bg-brand" />}>
          <BottomNav items={navItems} />
        </Suspense>
      </div>
    </div>
  );
}
