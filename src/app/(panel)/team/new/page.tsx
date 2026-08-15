import Link from "next/link";

import { EmployeeForm } from "@/components/features/team/EmployeeForm";
import { Avatar } from "@/components/ui/Avatar";
import { getTranslations } from "@/lib/i18n/server";
import { panelHref, ROUTES } from "@/lib/routes";
import { resolveWeekStart } from "@/lib/week-params";
import { requireAdmin } from "@/server/auth/session";
import { createEmployeeAction } from "@/server/actions/employee.actions";

interface NewEmployeePageProps {
  searchParams: Promise<{ week?: string }>;
}

export default async function NewEmployeePage({ searchParams }: NewEmployeePageProps) {
  const [{ dict }, , query] = await Promise.all([
    getTranslations(),
    requireAdmin(),
    searchParams,
  ]);

  const weekStart = resolveWeekStart(query.week);

  return (
    <section className="flex flex-col">
      <div className="flex items-center gap-3 border-y-2 border-ink bg-surface-alt px-4 py-3.5">
        <Avatar initials="+" size="lg" solid />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold">{dict.team.newPerson}</h1>
          <p className="text-xs text-muted">{dict.team.editHint}</p>
        </div>
        <Link
          href={panelHref(ROUTES.team, { week: weekStart })}
          className="flex-none border border-line-strong bg-surface px-2.5 py-[7px] text-xs font-bold hover:bg-hover"
        >
          {dict.common.back}
        </Link>
      </div>

      <EmployeeForm
        dict={dict}
        mode="create"
        values={{
          firstName: "",
          lastName: "",
          position: "",
          contract: "part",
          birthDate: "",
          hiredAt: "",
          hourlyRate: 130,
          leaveBalance: 0,
          phone: "",
          email: "",
          address: "",
        }}
        action={createEmployeeAction}
      />
    </section>
  );
}
