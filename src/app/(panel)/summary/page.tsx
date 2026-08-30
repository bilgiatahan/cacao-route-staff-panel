import Link from "next/link";

import { PageShell } from "@/components/layout/PageShell";
import { PeriodSwitcher } from "@/components/layout/PeriodSwitcher";
import { buildWeekPicker } from "@/components/layout/period-options";

import { OnShiftList } from "@/components/features/summary/OnShiftList";
import { PendingActions } from "@/components/features/summary/PendingActions";
import { WeekShiftList } from "@/components/features/summary/WeekShiftList";
import { PayrollTable } from "@/components/features/payroll/PayrollTable";
import { Card, IconTile, StatCard } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { PageHeader, SectionBlock } from "@/components/ui/Section";
import { addIsoDays, weekdayIndex } from "@/lib/date";
import {
  formatDayMonth,
  formatHourlyRate,
  formatHours,
  formatMoney,
  formatShiftSpan,
  formatWeekLabel,
} from "@/lib/format";
import { getTranslations } from "@/lib/i18n/server";
import { panelHref, ROUTES } from "@/lib/routes";
import { resolveWeekStart } from "@/lib/week-params";
import { requireSessionUser } from "@/server/auth/session";
import { getAdminSummary, getStaffSummary } from "@/server/services/summary.service";
import type { Dictionary } from "@/lib/i18n";
import type { IsoDate } from "@/types/domain";

interface SummaryPageProps {
  searchParams: Promise<{ week?: string }>;
}

/**
 * The page owns the tint and the gutter; every block inside is a Card — the rule
 * the Profile migration set. Summary stays narrow by choice: the admin branch has
 * genuinely parallel content and could use `width="wide"`, but that is a layout
 * composition of its own, not something to inherit by accident.
 */
const PAGE = "flex flex-1 flex-col gap-3.5 bg-fill px-4 pb-6 pt-3.5";

/**
 * Summary reports a single week, the same week the roster is showing. The
 * week/month switch that used to sit here is gone: the header now steps weeks
 * like Timetable does, so the two pages answer to the same `?week=` and the
 * nav carries it between them.
 */
const PERIOD = "week" as const;

function dayLabel(date: IsoDate, dict: Dictionary): string {
  const dayName = dict.calendar.daysLong[weekdayIndex(date)];
  return `${dayName} · ${formatDayMonth(date, dict)}`;
}

export default async function SummaryPage({ searchParams }: SummaryPageProps) {
  const [{ locale, dict }, user, params] = await Promise.all([
    getTranslations(),
    requireSessionUser(),
    searchParams,
  ]);

  const weekStart = resolveWeekStart(params.week);
  const weekLabel = formatWeekLabel(weekStart, dict);

  // Summary carries nothing but the week, so stepping it is the whole URL.
  const weekHref = (offsetWeeks: number) =>
    panelHref(ROUTES.summary, { week: addIsoDays(weekStart, offsetWeeks * 7) });

  // The switcher's label already states the range, so the header drops the
  // subtitle that used to repeat it.
  const weekSwitcher = (
    <PeriodSwitcher
      previousHref={weekHref(-1)}
      nextHref={weekHref(1)}
      label={weekLabel}
      previousLabel={dict.calendar.previousWeek}
      nextLabel={dict.calendar.nextWeek}
      ariaLabel={dict.calendar.thisWeek}
      picker={buildWeekPicker(weekStart, weekHref, dict)}
    />
  );

  if (user.role === "admin") {
    const summary = await getAdminSummary(weekStart, PERIOD);
    const pendingCount = summary.pendingLeave.length + summary.pendingSwaps.length;

    return (
      <PageShell width="data">
        <section className={PAGE}>
          <PageHeader
            variant="plain"
            title={dict.summary.title}
            action={weekSwitcher}
          />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard
              icon="clock"
              accent="blue"
              label={dict.summary.statTotalHours}
              value={formatHours(summary.payroll.totalHours, dict)}
              hint={`${summary.headcount} ${dict.summary.staffSuffix}`}
            />
            <StatCard
              icon="pay"
              accent="green"
              label={dict.summary.statCost}
              value={formatMoney(summary.payroll.totalCost)}
              hint={weekLabel}
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

          {/*
            Coverage and the worklist are the two questions a manager opens this
            page with, so on a desk they sit next to each other rather than one
            scroll apart. 7/5 because "who is on today" is a list of people and
            "what needs me" is a short queue.
          */}
          <div className="contents lg:flex lg:items-start lg:gap-3.5">
          <SectionBlock
            className="lg:min-w-0 lg:basis-0 lg:grow-[7]"
            title={dict.summary.todayTitle}
            meta={summary.today ? dayLabel(summary.today, dict) : dict.common.dash}
          >
            <OnShiftList rows={summary.onShiftToday} dict={dict} locale={locale} />
          </SectionBlock>

          <SectionBlock
            className="lg:min-w-0 lg:basis-0 lg:grow-[5]"
            title={dict.summary.needsAction}
          >
            <PendingActions
              leaveRequests={summary.pendingLeave}
              swapRequests={summary.pendingSwaps}
              employees={summary.roster.employees}
              shifts={summary.roster.shifts}
              dict={dict}
            />
          </SectionBlock>
          </div>

          <SectionBlock title={dict.team.payrollWeekly}>
            <PayrollTable report={summary.payroll} dict={dict} locale={locale} />
          </SectionBlock>
        </section>
      </PageShell>
    );
  }

  const summary = await getStaffSummary(user.employeeId, weekStart, PERIOD);
  if (!summary) {
    return (
      <PageShell width="data">
        <section className={PAGE}>
          <PageHeader
            variant="plain"
            title={dict.summary.title}
            subtitle={dict.summary.todayEmpty}
          />
        </section>
      </PageShell>
    );
  }

  const shiftDays = summary.myRow?.cells.filter((cell) => cell.shift).length ?? 0;
  const nextShift = summary.nextShift;

  return (
    <PageShell width="data">
      <section className={PAGE}>
        <PageHeader
          variant="plain"
          title={dict.summary.title}
          action={weekSwitcher}
        />

        {/*
          The next shift keeps its lead, but on a desk it no longer runs the
          whole width with three tiles stranded underneath: the hero and the
          numbers that qualify it read as one band.
        */}
        <div className="contents lg:flex lg:items-stretch lg:gap-2">
        {/* The one thing a barista opens the panel for, so it leads. */}
        <Card
          href={nextShift ? panelHref(ROUTES.timetable, { week: weekStart }) : undefined}
          padding="md"
          className="flex items-center gap-3 lg:min-w-0 lg:basis-0 lg:grow-[5]"
        >
          <IconTile name="calendarClock" accent="green" />
          <div className="min-w-0 flex-1">
            <div className="label-eyebrow truncate">{dict.summary.statNext}</div>
            <div className="tabular text-3xl font-extrabold -tracking-[0.02em]">
              {formatShiftSpan(nextShift?.shift ?? null, dict)}
            </div>
            <div className="truncate text-xs text-muted">
              {nextShift ? dayLabel(nextShift.date, dict) : dict.common.dash}
            </div>
          </div>
          {nextShift ? (
            <Icon name="chevronRight" className="h-4 w-4 flex-none text-muted" />
          ) : null}
        </Card>

        {/* Secondary numbers: two up on a phone, three where they fit. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:min-w-0 lg:basis-0 lg:grow-[7]">
          <StatCard
            icon="clock"
            accent="blue"
            label={dict.summary.statMyHours}
            value={formatHours(summary.myHours, dict)}
            hint={`${shiftDays} ${dict.summary.shiftsSuffix}`}
          />
          <StatCard
            icon="pay"
            accent="green"
            label={dict.summary.statMyPay}
            value={formatMoney(summary.myPay)}
            hint={formatHourlyRate(summary.employee.hourlyRate, dict)}
          />
          <StatCard
            icon="calendarCheck"
            accent="amber"
            label={dict.summary.statLeave}
            value={String(summary.leaveBalance)}
            hint={dict.leave.types.annual}
          />
        </div>
        </div>

        {/* Who else is in today, beside your own week — the two lists you
            actually compare. */}
        <div className="contents lg:flex lg:items-start lg:gap-3.5">
        <SectionBlock
          className="lg:min-w-0 lg:flex-1"
          title={dict.summary.todayTitle}
          meta={summary.today ? dayLabel(summary.today, dict) : dict.common.dash}
        >
          <OnShiftList
            rows={summary.onShiftToday}
            dict={dict}
            locale={locale}
            highlightEmployeeId={user.employeeId}
          />
        </SectionBlock>

        <Card className="overflow-hidden lg:min-w-0 lg:flex-1">
          <Link
            href={panelHref(ROUTES.timetable, { week: weekStart })}
            className="flex min-h-11 items-center gap-2.5 px-3.5 py-3 text-ink hover:bg-hover"
          >
            <IconTile name="timetable" accent="blue" />
            <span className="flex-1 truncate text-md font-bold">{dict.summary.myWeek}</span>
            <Icon name="chevronRight" className="h-4 w-4 text-muted" />
          </Link>
          <WeekShiftList cells={summary.myRow?.cells ?? []} dict={dict} today={summary.today} />
        </Card>
        </div>
      </section>
    </PageShell>
  );
}
