import { PageShell } from "@/components/layout/PageShell";
import { notFound } from "next/navigation";

import { PeriodSwitcher } from "@/components/layout/PeriodSwitcher";
import { buildMonthPicker, buildWeekPicker } from "@/components/layout/period-options";
import { EmployeeForm } from "@/components/features/team/EmployeeForm";
import { EmployeeMonthTable } from "@/components/features/team/EmployeeMonthTable";
import { WeekShiftList } from "@/components/features/summary/WeekShiftList";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { accentForId, Card, StatCard } from "@/components/ui/Card";
import { PageHeader, SectionBlock } from "@/components/ui/Section";
import { addIsoDays, addIsoMonths, todayIso } from "@/lib/date";
import { employeeFullName, employeeInitials, employeePosition } from "@/lib/employee";
import { formatHours, formatMoney, formatMonthName, formatWeekLabel } from "@/lib/format";
import { getTranslations } from "@/lib/i18n/server";
import { panelHref, ROUTES } from "@/lib/routes";
import { resolveMonth, resolveWeekStart } from "@/lib/week-params";
import { requireAdmin } from "@/server/auth/session";
import { archiveEmployeeAction, updateEmployeeAction } from "@/server/actions/employee.actions";
import { getEmployeeDetail } from "@/server/services/team.service";

interface EmployeeDetailPageProps {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ week?: string; month?: string }>;
}

/** The page owns the tint and the gutter; every block inside is a Card. */
const PAGE = "flex flex-1 flex-col gap-3.5 bg-fill px-4 pb-6 pt-3.5";

/**
 * One person, as the manager sees them.
 *
 * The screen answers two different questions and now looks like it: on the left
 * everything about them the manager *sets*, as a form; on the right everything
 * the schedule *produced*, as read-only figures. That split is the rule Profile
 * established — editable and read-only never look alike, and a fact you cannot
 * change is a `DetailList` row or a `StatCard`, never a disabled input.
 *
 * What the week and month cost used to be a `SectionHeading` meta string and a
 * loose grey paragraph under the form. They are the same numbers the person
 * sees on their own pay screen, so they are shown the same way.
 *
 * The week and the month each carry their own switcher and their own URL param,
 * and they move independently: reading someone's July while stepping through the
 * weeks of August is a real question. Both default to the period containing
 * today, so the page opens on now.
 */
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
  const month = resolveMonth(query.month);
  const detail = await getEmployeeDetail(routeParams.employeeId, weekStart, month);
  if (!detail) notFound();

  const { employee } = detail;
  const today = todayIso();
  const todayInWeek = detail.row?.cells.some((cell) => cell.date === today) ? today : null;

  // The manager cannot remove their own account from inside the panel.
  const canArchive = employee.id !== admin.employeeId && !employee.isTaskRow;

  // Stepping one period always carries the other, so the switchers never undo
  // each other's selection. One builder per period feeds both its arrows and its
  // picker, which is what keeps a jump and a step producing the same URL.
  const periodHref = (params: { week?: string; month?: string }) =>
    panelHref(ROUTES.teamMember(employee.id), { week: weekStart, month, ...params });
  const weekHref = (offset: number) =>
    periodHref({ week: addIsoDays(weekStart, offset * 7) });
  const monthHref = (offset: number) => periodHref({ month: addIsoMonths(month, offset) });

  return (
    <PageShell width="data">
      <section className={PAGE}>
        <PageHeader
          variant="plain"
          title={dict.team.details}
          action={
            // `md`, not `sm`: 44px. `sm` is 40px and is for dense inline
            // controls, which a page-level back affordance is not.
            <Button href={ROUTES.team} variant="outline">
              {dict.common.back}
            </Button>
          }
        />

        {/* Who this page is about. The accent is derived from the id, so it is
            the same colour they carry in the team list and on the summary. */}
        <Card padding="md" className="flex items-center gap-3">
          <Avatar
            initials={employeeInitials(employee)}
            tone={accentForId(employee.id)}
            size="lg"
            className="rounded-full"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-extrabold">
              {employeeFullName(employee)}
            </h1>
            <p className="truncate text-xs text-muted">{employeePosition(employee, locale)}</p>
          </div>
        </Card>

        <div className="contents lg:flex lg:items-start lg:gap-3.5">
          <div className="contents lg:block lg:min-w-0 lg:basis-0 lg:grow-[7]">
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
          </div>

          <div className="contents lg:flex lg:min-w-0 lg:basis-0 lg:grow-5 lg:flex-col lg:gap-3.5">
            {/* One block for the week: what it came to, then the days it came
                from. The heading names the unit and the switcher names the
                period — neither repeats the other, which is why the heading is
                no longer "This Week". */}
            <SectionBlock
              title={dict.team.weekSection}
              action={
                <PeriodSwitcher
                  previousHref={weekHref(-1)}
                  nextHref={weekHref(1)}
                  label={formatWeekLabel(weekStart, dict)}
                  previousLabel={dict.calendar.previousWeek}
                  nextLabel={dict.calendar.nextWeek}
                  ariaLabel={dict.calendar.pickWeek}
                  picker={buildWeekPicker(weekStart, weekHref, dict)}
                />
              }
            >
              <div className="grid grid-cols-2 gap-2">
                <StatCard
                  icon="timetable"
                  accent="green"
                  label={dict.team.weekHours}
                  value={formatHours(detail.weeklyHours, dict)}
                />
                <StatCard
                  icon="wallet"
                  accent="green"
                  label={dict.team.weekPay}
                  value={formatMoney(detail.weeklyPay.total)}
                />
              </div>
              <Card className="overflow-hidden">
                <WeekShiftList
                  cells={detail.row?.cells ?? []}
                  dict={dict}
                  today={todayInWeek}
                  bare
                />
              </Card>
            </SectionBlock>

            {/* The month is the shifts actually worked in it — not this week
                multiplied out — so it moves on its own switcher, and the table
                underneath shows which weeks the total came from. */}
            <SectionBlock
              title={dict.team.monthSection}
              action={
                <PeriodSwitcher
                  previousHref={monthHref(-1)}
                  nextHref={monthHref(1)}
                  label={formatMonthName(month, dict)}
                  previousLabel={dict.calendar.previousMonth}
                  nextLabel={dict.calendar.nextMonth}
                  ariaLabel={dict.calendar.pickMonth}
                  picker={buildMonthPicker(month, monthHref, dict)}
                />
              }
            >
              <div className="grid grid-cols-2 gap-2">
                <StatCard
                  icon="clock"
                  accent="green"
                  label={dict.team.monthlyHours}
                  value={formatHours(detail.month.hours, dict)}
                  hint={`${detail.month.weeksWorked}/${detail.month.weeks.length} ${dict.units.weeks}`}
                />
                <StatCard
                  icon="wallet"
                  accent="green"
                  label={dict.team.monthlyPay}
                  value={formatMoney(detail.month.pay)}
                  hint={`${detail.month.weeksWorked}/${detail.month.weeks.length} ${dict.units.weeks}`}
                />
              </div>
              <EmployeeMonthTable month={detail.month} dict={dict} today={today} />
            </SectionBlock>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
