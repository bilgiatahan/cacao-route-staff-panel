import { OnShiftList } from "@/components/features/summary/OnShiftList";
import { PendingActions } from "@/components/features/summary/PendingActions";
import { WeekShiftList } from "@/components/features/summary/WeekShiftList";
import { PayrollTable } from "@/components/features/payroll/PayrollTable";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { PageHeader, SectionHeading } from "@/components/ui/Section";
import { StatTile } from "@/components/ui/StatTile";
import { fromIsoDate } from "@/lib/date";
import {
  formatDayMonth,
  formatHours,
  formatMoney,
  formatMonthLabel,
  formatShiftSpan,
  formatWeekLabel,
} from "@/lib/format";
import { getTranslations } from "@/lib/i18n/server";
import { panelHref, ROUTES } from "@/lib/routes";
import { resolvePeriod, resolveWeekStart } from "@/lib/week-params";
import { requireSessionUser } from "@/server/auth/session";
import { getAdminSummary, getStaffSummary } from "@/server/services/summary.service";
import type { Dictionary } from "@/lib/i18n";
import type { IsoDate } from "@/types/domain";

interface SummaryPageProps {
  searchParams: Promise<{ week?: string; period?: string }>;
}

function periodOptions(
  dict: Dictionary,
  weekStart: IsoDate,
  active: "week" | "month",
) {
  return [
    {
      key: "week",
      label: dict.calendar.thisWeek,
      href: panelHref(ROUTES.summary, { week: weekStart, period: "week" }),
      active: active === "week",
    },
    {
      key: "month",
      label: dict.calendar.thisMonth,
      href: panelHref(ROUTES.summary, { week: weekStart, period: "month" }),
      active: active === "month",
    },
  ];
}

function todayLabel(date: IsoDate, dict: Dictionary): string {
  const index = fromIsoDate(date).getDay();
  const dayName = dict.calendar.daysLong[index === 0 ? 6 : index - 1];
  return `${dayName} ${formatDayMonth(date, dict)}`;
}

export default async function SummaryPage({ searchParams }: SummaryPageProps) {
  const [{ locale, dict }, user, params] = await Promise.all([
    getTranslations(),
    requireSessionUser(),
    searchParams,
  ]);

  const weekStart = resolveWeekStart(params.week);
  const period = resolvePeriod(params.period);
  const isMonth = period === "month";
  const periodLabel = isMonth
    ? formatMonthLabel(weekStart, dict)
    : formatWeekLabel(weekStart, dict);

  const segments = (
    <SegmentedControl
      ariaLabel={dict.calendar.thisWeek}
      options={periodOptions(dict, weekStart, period)}
      className="mx-4 mb-3.5"
    />
  );

  if (user.role === "admin") {
    const summary = await getAdminSummary(weekStart, period);

    return (
      <section className="flex flex-col">
        <PageHeader
          title={dict.summary.title}
          subtitle={`${dict.brand.branch} · ${formatWeekLabel(weekStart, dict)}`}
        />
        {segments}

        <div className="grid grid-cols-2 border-t-2 border-ink">
          <StatTile
            label={isMonth ? dict.summary.statMonthlyHours : dict.summary.statTotalHours}
            value={formatHours(summary.payroll.totalHours, dict)}
            hint={
              isMonth
                ? `${summary.weeksInPeriod} ${dict.units.weeks}`
                : `${summary.headcount} ${dict.summary.staffSuffix}`
            }
          />
          <StatTile
            label={dict.summary.statCost}
            value={formatMoney(summary.payroll.totalCost)}
            hint={periodLabel}
            tone="brand"
          />
          <StatTile
            label={dict.summary.statGaps}
            value={String(summary.gapDays)}
            hint={summary.gapDays > 0 ? dict.summary.gapDays : dict.summary.noGap}
            tone={summary.gapDays > 0 ? "warn" : "neutral"}
            highlight={summary.gapDays > 0}
          />
          <StatTile
            label={dict.summary.statPending}
            value={String(summary.pendingLeave.length + summary.pendingSwaps.length)}
            hint={dict.summary.pendingSuffix}
            tone={summary.pendingLeave.length > 0 ? "warn" : "neutral"}
            highlight={summary.pendingLeave.length > 0}
          />
        </div>

        <SectionHeading
          title={dict.summary.todayTitle}
          meta={summary.today ? todayLabel(summary.today, dict) : dict.common.dash}
        />
        <OnShiftList rows={summary.onShiftToday} dict={dict} locale={locale} />

        <SectionHeading title={dict.summary.needsAction} />
        <PendingActions
          leaveRequests={summary.pendingLeave}
          swapRequests={summary.pendingSwaps}
          employees={summary.roster.employees}
          shifts={summary.roster.shifts}
          dict={dict}
          locale={locale}
          weekStart={weekStart}
        />

        <SectionHeading
          title={isMonth ? dict.team.payrollMonthly : dict.team.payrollWeekly}
        />
        <PayrollTable report={summary.payroll} dict={dict} locale={locale} />
      </section>
    );
  }

  const summary = await getStaffSummary(user.employeeId, weekStart, period);
  if (!summary) {
    return (
      <section className="flex flex-col">
        <PageHeader title={dict.summary.title} subtitle={dict.summary.todayEmpty} />
      </section>
    );
  }

  const shiftDays = summary.myRow?.cells.filter((cell) => cell.shift).length ?? 0;

  return (
    <section className="flex flex-col">
      <PageHeader
        title={dict.summary.title}
        subtitle={`${user.fullName} · ${formatWeekLabel(weekStart, dict)}`}
      />
      {segments}

      <div className="grid grid-cols-2 border-t-2 border-ink">
        <StatTile
          label={isMonth ? dict.summary.statMonthlyHours : dict.summary.statMyHours}
          value={formatHours(summary.myHours, dict)}
          hint={
            isMonth
              ? `${summary.weeksInPeriod} ${dict.units.weeks}`
              : `${shiftDays} ${dict.summary.shiftsSuffix}`
          }
        />
        <StatTile
          label={isMonth ? dict.summary.statMonthlyPay : dict.summary.statMyPay}
          value={formatMoney(summary.myPay)}
          hint={isMonth ? periodLabel : `${summary.employee.hourlyRate} ${dict.units.perHour}`}
          tone="brand"
        />
        <StatTile
          label={dict.summary.statNext}
          value={formatShiftSpan(summary.nextShift?.shift ?? null, dict)}
          hint={
            summary.nextShift
              ? dict.calendar.daysLong[
                  (fromIsoDate(summary.nextShift.date).getDay() + 6) % 7
                ]
              : ""
          }
        />
        <StatTile
          label={dict.summary.statLeave}
          value={String(summary.leaveBalance)}
          hint={dict.leave.types.annual}
        />
      </div>

      <SectionHeading
        title={dict.summary.todayTitle}
        meta={summary.today ? todayLabel(summary.today, dict) : dict.common.dash}
      />
      <OnShiftList
        rows={summary.onShiftToday}
        dict={dict}
        locale={locale}
        highlightEmployeeId={user.employeeId}
      />

      <SectionHeading title={dict.summary.myWeek} />
      <WeekShiftList
        cells={summary.myRow?.cells ?? []}
        dict={dict}
        today={summary.today}
      />
    </section>
  );
}
