import { Suspense, type ReactNode } from "react";

import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav, type NavItem } from "@/components/layout/BottomNav";
import { getTranslations } from "@/lib/i18n/server";
import { ROUTES } from "@/lib/routes";
import { requireCurrentEmployee } from "@/server/auth/session";
import { leaveRepository } from "@/server/repositories/leave.repository";
import { notificationRepository } from "@/server/repositories/notification.repository";
import { swapRepository } from "@/server/repositories/swap.repository";

/**
 * The app shell: a single 560px column with a sticky header and tab bar, which
 * is the frame every panel tab renders inside.
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

  const [unreadCount, pendingLeave, pendingSwaps] = await Promise.all([
    notificationRepository.countUnread(user),
    isAdmin ? leaveRepository.listByStatus("pending") : Promise.resolve([]),
    isAdmin ? swapRepository.listByStatus("pending") : Promise.resolve([]),
  ]);

  const navItems: NavItem[] = [
    {
      key: "timetable",
      href: ROUTES.timetable,
      label: dict.nav.timetable,
      icon: "timetable",
      badge: 0,
    },
    {
      key: "summary",
      href: ROUTES.summary,
      label: dict.nav.summary,
      icon: "summary",
      badge: 0,
    },

    {
      key: "leave",
      href: ROUTES.leave,
      label: dict.nav.leave,
      icon: "leave",
      badge: pendingLeave.length + pendingSwaps.length,
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
      <div className="relative flex min-h-dvh w-full max-w-140 flex-col  shadow-[0_0_0_1px_var(--color-line)]">
        <AppHeader
          dict={dict}
          user={user}
          employee={employee}
          locale={locale}
          unreadCount={unreadCount}
        />
        <main className="flex flex-1 flex-col ">
          {children}
          <div className="h-7" />
        </main>

        <Suspense
          fallback={<div className="h-14 border-t-2 border-ink bg-surface" />}
        >
          <BottomNav items={navItems} />
        </Suspense>
      </div>
    </div>
  );
}
