import Link from "next/link";

import { CountBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { APP_VERSION } from "@/lib/constants";
import { employeeInitials } from "@/lib/employee";
import type { Dictionary } from "@/lib/i18n";
import { ROUTES } from "@/lib/routes";
import type { Employee, Locale, SessionUser } from "@/types/domain";

import { AppMenu, type MenuEntry } from "./AppMenu";

export interface AppHeaderProps {
  dict: Dictionary;
  user: SessionUser;
  employee: Employee;
  locale: Locale;
  unreadCount: number;
}

/**
 * Three slots: the drawer trigger, the brand, and the notification bell.
 *
 * It stays this thin on purpose — each screen states its own identity through
 * `PageHeader`, so repeating it here would say the same thing twice. Sign-out
 * lives in the drawer, not up here where it sits next to a destructive-free
 * toolbar and invites a mis-tap.
 */
export function AppHeader({ dict, user, employee, locale, unreadCount }: AppHeaderProps) {
  const roleTitle =
    user.role === "admin" ? dict.brand.managerTitle : employee.position[locale];

  // Secondary destinations only, and only ones that exist. The monthly cost
  // report is admin-only, so it appears here rather than in the tab bar every
  // barista sees; settings, support and legal get rows when they get pages.
  const menuEntries: MenuEntry[] = [
    ...(user.role === "admin"
      ? [
          {
            key: "reports",
            label: dict.menu.reports,
            icon: "summary" as const,
            href: ROUTES.reports,
          },
        ]
      : []),
    { key: "profile", label: dict.menu.profile, icon: "user", href: ROUTES.profile },
  ];

  const unreadLabel = `${unreadCount} ${dict.notifications.unread}`;

  return (
    // A sticky bar needs its own ground: without one, cards scrolled underneath
    // and straight through the brand mark.
    //
    // `lg:hidden` retires the whole bar on a desktop, and `AppMenu` with it —
    // its trigger, scrim and drawer are all rendered inside this element, so one
    // class removes the drawer system rather than leaving a focusable hamburger
    // behind an invisible overlay. Everything it holds (brand, bell, the
    // drawer's account block) is in `SideNav` from 1024 up.
    <header className="sticky top-0 z-20 border-b border-line bg-surface lg:hidden">
      <div className="mx-auto flex max-w-panel items-center gap-2 px-3 py-1.5">
        <AppMenu
          labels={{
            open: dict.menu.open,
            language: dict.menu.language,
            signOut: dict.menu.signOut,
            version: dict.menu.version,
          }}
          entries={menuEntries}
          profile={{
            name: user.fullName,
            role: roleTitle,
            email: user.email,
            initials: employeeInitials(employee),
          }}
          appVersion={APP_VERSION}
        />

        <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
          <span className="truncate text-lg font-extrabold leading-none tracking-[0.14em] text-brand">
            {dict.brand.name}
          </span>
          <span className="truncate text-2xs font-semibold uppercase tracking-[0.18em] text-muted">
            {dict.brand.panel}
          </span>
        </div>

        <Link
          href={ROUTES.notifications}
          // The digit alone is not a label, so the count is spelled out here.
          aria-label={
            unreadCount > 0
              ? `${dict.nav.notifications}, ${unreadLabel}`
              : dict.nav.notifications
          }
          className="relative flex size-11 flex-none items-center justify-center rounded-md text-ink hover:bg-hover"
        >
          <Icon name="notifications" className="h-5 w-5" />
          <CountBadge
            count={unreadCount}
            label={unreadLabel}
            className="absolute right-1 top-1"
          />
        </Link>
      </div>
    </header>
  );
}
