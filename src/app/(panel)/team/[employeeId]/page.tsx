import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { notFound } from "next/navigation";

import { EmployeeForm } from "@/components/features/team/EmployeeForm";
import { WeekShiftList } from "@/components/features/summary/WeekShiftList";
import { Avatar } from "@/components/ui/Avatar";
import { SectionHeading } from "@/components/ui/Section";
import { todayIso } from "@/lib/date";
import { employeeFullName, employeeInitials, employeePosition } from "@/lib/employee";
import { formatHours, formatMoney } from "@/lib/format";
import { getTranslations } from "@/lib/i18n/server";
import { panelHref, ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { resolveWeekStart } from "@/lib/week-params";
import { requireAdmin } from "@/server/auth/session";
import { archiveEmployeeAction, updateEmployeeAction } from "@/server/actions/employee.actions";
import { getEmployeeDetail } from "@/server/services/team.service";

interface EmployeeDetailPageProps {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ week?: string }>;
}

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: EmployeeDetailPageProps) {
  const [{ locale, dict }, admin, routeParams, query] = await Promise.all([
    getTranslations(),
    requireAdmin(),
    params,
    searchParams,
  ]);

  const weekStart = resolveWeekStart(query.week);
  const detail = await getEmployeeDetail(routeParams.employeeId, weekStart);
  if (!detail) notFound();

  const { employee } = detail;
  const today = todayIso();
  const todayInWeek = detail.row?.cells.some((cell) => cell.date === today) ? today : null;

  // The manager cannot remove their own account from inside the panel.
  const canArchive = employee.id !== admin.employeeId && !employee.isTaskRow;

  return (
    <PageShell>
      <section className="flex flex-1 flex-col">
        <div className="flex items-center gap-3 border-y-2 border-ink bg-surface-alt px-4 py-3.5">
          <Avatar initials={employeeInitials(employee, locale)} size="lg" solid />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold">
              {employeeFullName(employee, locale)}
            </h1>
            <p className="text-xs text-muted">{employeePosition(employee, locale)}</p>
          </div>
          <Link
            href={panelHref(ROUTES.team, { week: weekStart })}
            className="inline-flex min-h-11 flex-none items-center border border-line-strong bg-surface px-2.5 text-xs font-bold hover:bg-hover"
          >
            {dict.common.back}
          </Link>
        </div>

        <EmployeeForm
          dict={dict}
          mode="edit"
          hasAccount={detail.hasAccount}
          values={{
            firstName: employee.firstName,
            lastName: employee.lastName,
            position: employeePosition(employee, locale),
            contract: employee.contract,
            birthDate: employee.birthDate ?? "",
            hiredAt: employee.hiredAt ?? "",
            hourlyRate: employee.hourlyRate,
            leaveBalance: employee.leaveBalance,
            phone: employee.phone,
            email: employee.email,
            address: employee.address,
          }}
          action={updateEmployeeAction.bind(null, employee.id)}
          onArchive={canArchive ? archiveEmployeeAction.bind(null, employee.id) : undefined}
        />

        <SectionHeading
          title={dict.team.thisWeek}
          meta={
            <span className={cn("tabular", detail.overtime ? "text-warn-dark" : "text-muted")}>
              {formatHours(detail.weeklyHours, dict)} · {formatMoney(detail.weeklyPay.total)}
            </span>
          }
        />
        <p className="tabular px-4 pb-2.5 text-xs text-muted">
          {dict.team.monthlyHours}: {formatHours(detail.monthlyHours, dict)} ·{" "}
          {formatMoney(detail.monthlyPay)} ({detail.weeksInMonth} {dict.units.weeks})
        </p>
        <WeekShiftList cells={detail.row?.cells ?? []} dict={dict} today={todayInWeek} />
      </section>
    </PageShell>
  );
}
