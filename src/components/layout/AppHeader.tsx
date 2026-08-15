import { Suspense } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { employeeInitials } from "@/lib/employee";
import { formatWeekLabel } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { signOutAction } from "@/server/actions/auth.actions";
import { toggleLocaleAction } from "@/server/actions/locale.actions";
import type { Employee, IsoDate, SessionUser } from "@/types/domain";

import { WeekSwitcher } from "./WeekSwitcher";

export interface AppHeaderProps {
  dict: Dictionary;
  user: SessionUser;
  employee: Employee;
  locale: "tr" | "en";
  /** Week resolved on the server; the switcher re-derives it after navigation. */
  weekStart: IsoDate;
}

export function AppHeader({ dict, user, employee, locale, weekStart }: AppHeaderProps) {
  const roleTitle =
    user.role === "admin" ? dict.brand.managerTitle : employee.position[locale];

  return (
    <header className="sticky top-0 z-20 border-b-2 border-ink bg-surface">
      <div className="flex items-center justify-between gap-3 px-4 pb-2.5 pt-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-lg font-extrabold leading-none tracking-[0.14em]">
            {dict.brand.name}
          </span>
          <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted">
            {dict.brand.panel}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <form action={toggleLocaleAction}>
            <button
              type="submit"
              className="border border-line-strong bg-surface px-2.5 py-[7px] text-xs font-bold tracking-[0.08em] text-ink hover:bg-hover"
            >
              {dict.common.languageToggle}
            </button>
          </form>

          <span className="border border-brand bg-brand px-2.5 py-[7px] text-xs font-bold tracking-[0.08em] text-white">
            {user.role === "admin" ? dict.roles.admin : dict.roles.staff}
          </span>

          <form action={signOutAction}>
            <button
              type="submit"
              className="border border-line-strong bg-surface px-2.5 py-[7px] text-xs font-bold tracking-[0.08em] text-muted hover:bg-hover hover:text-ink"
            >
              {dict.auth.signOut}
            </button>
          </form>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-4 pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar initials={employeeInitials(employee, locale)} size="sm" solid />
          <span className="truncate text-sm font-semibold">
            {user.fullName} · {roleTitle}
          </span>
        </div>

        <Suspense fallback={null}>
          <WeekSwitcher
            previousLabel={dict.calendar.previousWeek}
            nextLabel={dict.calendar.nextWeek}
            fallbackLabel={formatWeekLabel(weekStart, dict)}
            monthNames={dict.calendar.months}
          />
        </Suspense>
      </div>
    </header>
  );
}
