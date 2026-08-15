import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import { APP_VERSION } from "@/lib/constants";
import { employeeInitials } from "@/lib/employee";
import type { Dictionary } from "@/lib/i18n";
import { ROUTES } from "@/lib/routes";
import type { Employee, SessionUser } from "@/types/domain";

import { AppMenu, type MenuEntry } from "./AppMenu";

export interface AppHeaderProps {
  dict: Dictionary;
  user: SessionUser;
  employee: Employee;
  locale: "tr" | "en";
  unreadCount: number;
}

export function AppHeader({
  dict,
  user,
  employee,
  locale,
  unreadCount,
}: AppHeaderProps) {
  const roleTitle =
    user.role === "admin" ? dict.brand.managerTitle : employee.position[locale];

  // Only the manager can open an employee record; staff see their own numbers
  // on the pay tab. Everything else in the menu is still to be built, and says
  // so rather than linking nowhere.
  const profileHref = user.role === "admin" ? ROUTES.teamMember(user.employeeId) : ROUTES.team;

  const menuGroups: MenuEntry[][] = [
    [
      { key: "profile", label: dict.menu.profile, icon: "user", href: profileHref },
      { key: "work", label: dict.menu.workDetails, icon: "briefcase" },
      { key: "settings", label: dict.menu.settings, icon: "settings" },
      {
        key: "notificationPrefs",
        label: dict.menu.notificationPrefs,
        icon: "notifications",
      },
      { key: "support", label: dict.menu.support, icon: "support" },
    ],
    [{ key: "privacy", label: dict.menu.privacy, icon: "shield" }],
  ];

  return (
    <header className="sticky top-0 z-20">
      <div className="grid grid-cols-[36px_1fr_36px] items-center gap-2 px-3 pb-2.5 pt-2.5">
        <AppMenu
          labels={{
            open: dict.menu.open,
            close: dict.menu.close,
            language: dict.menu.language,
            signOut: dict.menu.signOut,
            version: dict.menu.version,
            soon: dict.menu.soon,
          }}
          groups={menuGroups}
          profile={{
            name: user.fullName,
            role: roleTitle,
            email: user.email,
            initials: employeeInitials(employee, locale),
          }}
          appVersion={APP_VERSION}
        />

        <div className="flex min-w-0 flex-col items-center gap-0.5">
          <span className="truncate text-lg text-brand font-extrabold leading-none tracking-[0.14em]">
            {dict.brand.name}
          </span>
          <span className="truncate text-2xs font-semibold uppercase tracking-[0.18em] text-muted">
            {dict.brand.panel}
          </span>
        </div>

        <Link
          href={ROUTES.notifications}
          aria-label={dict.nav.notifications}
          className="relative flex size-9 flex-none items-center justify-center text-ink hover:bg-hover"
        >
          <Icon name="notifications" className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="tabular absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center bg-warn px-[3px] text-nano font-extrabold text-ink">
              {unreadCount}
            </span>
          ) : null}
        </Link>
      </div>

    </header>
  );
}
