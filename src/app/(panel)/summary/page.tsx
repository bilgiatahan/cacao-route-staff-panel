import Link from "next/link";
import type { ReactNode } from "react";

import { OnShiftList } from "@/components/features/summary/OnShiftList";
import { PendingActions } from "@/components/features/summary/PendingActions";
import { WeekShiftList } from "@/components/features/summary/WeekShiftList";
import { PayrollTable } from "@/components/features/payroll/PayrollTable";
import { Card, IconTile, StatCard } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { PageHeader, SectionHeading } from "@/components/ui/Section";
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

/** The page is a stack of cards on the shell's tint, gutter to gutter. */
const PAGE = "flex flex-1 flex-col gap-3.5 px-4 pb-6";

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

function dayLabel(date: IsoDate, dict: Dictionary): string {
  const index = fromIsoDate(date).getDay();
  const dayName = dict.calendar.daysLong[index === 0 ? 6 : index - 1];
  return `${dayName} · ${formatDayMonth(date, dict)}`;
}

/** Heading plus the block it introduces, kept together as one rhythm unit. */
function Block({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SectionHeading variant="plain" title={title} meta={meta} />
      {children}
    </div>
  );
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
    />
  );

  if (user.role === "admin") {
    const summary = await getAdminSummary(weekStart, period);
    const pendingCount = summary.pendingLeave.length + summary.pendingSwaps.length;

    return (
      <section className={PAGE}>
        <PageHeader
          variant="plain"
          title={dict.summary.title}
          subtitle={`${formatWeekLabel(weekStart, dict)}`}
        />
        {segments}

        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon="clock"
            accent="blue"
            label={isMonth ? dict.summary.statMonthlyHours : dict.summary.statTotalHours}
            value={formatHours(summary.payroll.totalHours, dict)}
            hint={
              isMonth
                ? `${summary.weeksInPeriod} ${dict.units.weeks}`
                : `${summary.headcount} ${dict.summary.staffSuffix}`
            }
          />
          <StatCard
            icon="pay"
            accent="green"
            label={dict.summary.statCost}
            value={formatMoney(summary.payroll.totalCost)}
            hint={periodLabel}
          />
          <StatCard
            icon="calendarCheck"
            accent="amber"
            label={dict.summary.statGaps}
            value={String(summary.gapDays)}
            hint={summary.gapDays > 0 ? dict.summary.gapDays : dict.summary.noGap}
            highlight={summary.gapDays > 0}
          />
          <StatCard
            icon="inbox"
            accent="violet"
            label={dict.summary.statPending}
            value={String(pendingCount)}
            hint={dict.summary.pendingSuffix}
            highlight={pendingCount > 0}
          />
        </div>

        <Block
          title={dict.summary.todayTitle}
          meta={summary.today ? dayLabel(summary.today, dict) : dict.common.dash}
        >
          <OnShiftList rows={summary.onShiftToday} dict={dict} locale={locale} />
        </Block>

        <Block title={dict.summary.needsAction}>
          <PendingActions
            leaveRequests={summary.pendingLeave}
            swapRequests={summary.pendingSwaps}
            employees={summary.roster.employees}
            shifts={summary.roster.shifts}
            dict={dict}
            locale={locale}
            weekStart={weekStart}
          />
        </Block>

        <Block title={isMonth ? dict.team.payrollMonthly : dict.team.payrollWeekly}>
          <PayrollTable report={summary.payroll} dict={dict} locale={locale} />
        </Block>
      </section>
    );
  }

  const summary = await getStaffSummary(user.employeeId, weekStart, period);
  if (!summary) {
    return (
      <section className={PAGE}>
        <PageHeader
          variant="plain"
          title={dict.summary.title}
          subtitle={dict.summary.todayEmpty}
        />
      </section>
    );
  }

  const shiftDays = summary.myRow?.cells.filter((cell) => cell.shift).length ?? 0;
  const nextShift = summary.nextShift;

  return (
    <section className={PAGE}>
      <PageHeader
        variant="plain"
        title={dict.summary.title}
        subtitle={`${formatWeekLabel(weekStart, dict)}`}
      />
      {segments}

      <div className="grid grid-cols-3 gap-2">
        <StatCard
          icon="clock"
          accent="blue"
          label={isMonth ? dict.summary.statMonthlyHours : dict.summary.statMyHours}
          value={formatHours(summary.myHours, dict)}
          hint={
            isMonth
              ? `${summary.weeksInPeriod} ${dict.units.weeks}`
              : `${shiftDays} ${dict.summary.shiftsSuffix}`
          }
        />
        <StatCard
          icon="pay"
          accent="green"
          label={isMonth ? dict.summary.statMonthlyPay : dict.summary.statMyPay}
          value={formatMoney(summary.myPay)}
          hint={
            isMonth ? periodLabel : `${summary.employee.hourlyRate} ${dict.units.perHour}`
          }
        />
        <StatCard
          icon="calendarCheck"
          accent="amber"
          label={dict.summary.statLeave}
          value={String(summary.leaveBalance)}
          hint={dict.leave.types.annual}
        />
      </div>

      {/* The next shift is the one number a barista opens the panel for. */}
      <Card
        href={nextShift ? panelHref(ROUTES.timetable, { week: weekStart }) : undefined}
        className="flex items-center gap-3 px-3 py-3"
      >
        <IconTile name="calendarClock" accent="green" className="size-10" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-md font-bold">{dict.summary.statNext}</div>
          <div className="truncate text-xs text-muted">
            {nextShift ? dayLabel(nextShift.date, dict) : dict.common.dash}
          </div>
          <div className="tabular mt-0.5 text-3xl font-extrabold -tracking-[0.02em]">
            {formatShiftSpan(nextShift?.shift ?? null, dict)}
          </div>
        </div>
        {nextShift ? (
          <Icon name="chevronRight" className="h-4 w-4 text-muted-soft" />
        ) : null}
      </Card>

      <Block
        title={dict.summary.todayTitle}
        meta={summary.today ? dayLabel(summary.today, dict) : dict.common.dash}
      >
        <OnShiftList
          rows={summary.onShiftToday}
          dict={dict}
          locale={locale}
          highlightEmployeeId={user.employeeId}
        />
      </Block>

      <Card className="overflow-hidden">
        <Link
          href={panelHref(ROUTES.timetable, { week: weekStart })}
          className="flex items-center gap-2.5 border-b border-line px-3 py-3 text-ink hover:bg-hover"
        >
          <IconTile name="timetable" accent="blue" />
          <span className="flex-1 truncate text-md font-bold">{dict.summary.myWeek}</span>
          <Icon name="chevronRight" className="h-4 w-4 text-muted-soft" />
        </Link>
        <WeekShiftList bare cells={summary.myRow?.cells ?? []} dict={dict} today={summary.today} />
      </Card>
    </section>
  );
}
