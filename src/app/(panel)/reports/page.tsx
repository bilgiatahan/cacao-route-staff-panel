import Link from "next/link";

import { EmployeeCostDonut } from "@/components/features/reports/EmployeeCostDonut";
import { TrendChip } from "@/components/features/reports/TrendChip";
import { WeekComparisonPanel } from "@/components/features/reports/WeekComparisonPanel";
import { WeekCostTable } from "@/components/features/reports/WeekCostTable";
import { WeeklyCostChart } from "@/components/features/reports/WeeklyCostChart";
import {
  buildChartBars,
  buildComparisonRows,
  buildDonutSlices,
  buildStatCards,
  buildWeekRows,
  buildWeekSegments,
  resolveSelectedWeekIndex,
  selectedWeekLabel,
  selectedWeekPartialNotice,
  weeksWithDataLabel,
} from "@/components/features/reports/view-model";
import { PageShell } from "@/components/layout/PageShell";
import { StatCard } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Hint, PageHeader, SectionBlock } from "@/components/ui/Section";
import { nextIsoMonth, previousIsoMonth } from "@/lib/date";
import { formatMoney, formatMonthName } from "@/lib/format";
import { getTranslations } from "@/lib/i18n/server";
import { panelHref, ROUTES } from "@/lib/routes";
import { resolveMonth } from "@/lib/week-params";
import { requireAdmin } from "@/server/auth/session";
import { getMonthlyCostReport } from "@/server/services/monthly-cost.service";

/**
 * Monthly personnel cost.
 *
 * Admin-only, and a Server Component all the way down: every control on the page
 * is a link or a plain GET form, so the month, the selected week and the language
 * all live in the URL and nothing but markup reaches the browser. The two charts
 * are drawn from the report's own numbers — no chart library, no client boundary.
 *
 * The page does no arithmetic. `getMonthlyCostReport` produces the figures and
 * `view-model.ts` turns them into strings; what is left here is layout.
 */

interface ReportsPageProps {
  searchParams: Promise<{ month?: string; week?: string }>;
}

const PAGE = "flex flex-1 flex-col gap-3.5 bg-fill px-4 pb-6 pt-3.5";

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const [{ locale, dict }, , params] = await Promise.all([
    getTranslations(),
    // Cost across the whole roster is a manager's view; staff see their own pay
    // on /team. Redirects rather than throws, which is right for a page.
    requireAdmin(),
    searchParams,
  ]);

  const month = resolveMonth(params.month);
  const report = await getMonthlyCostReport(month);

  const selectedIndex = resolveSelectedWeekIndex(report, params.week);
  const stats = buildStatCards(report, dict);

  return (
    <PageShell width="data">
      <section className={PAGE}>
        <div className="contents lg:flex lg:items-center lg:justify-between lg:gap-3">
          <PageHeader
            variant="plain"
            title={dict.reports.title}
            subtitle={formatMonthName(month, dict)}
          />

          <div className="flex flex-none items-center gap-1.5">
            {/*
              A month picker with no JavaScript: a GET form whose only field is
              `<input type="month">`, so the browser supplies the calendar and
              the navigation is an ordinary request. The selected week is
              deliberately not carried across — a week index means nothing in a
              different month.
            */}
            <form action={ROUTES.reports} className="flex items-center gap-1.5">
              <label className="sr-only" htmlFor="month">
                {dict.calendar.pickMonth}
              </label>
              <input
                id="month"
                type="month"
                name="month"
                defaultValue={month}
                className="h-11 rounded-md border border-line bg-surface px-2.5 text-control"
              />
              <button
                type="submit"
                className="flex h-11 items-center gap-1.5 rounded-md bg-brand px-3.5 text-base font-bold text-white hover:bg-brand-dark"
              >
                <Icon name="timetable" className="h-4 w-4" />
                <span className="hidden sm:inline">{dict.calendar.pickMonth}</span>
              </button>
            </form>

            <Link
              href={panelHref(ROUTES.reports, { month: previousIsoMonth(month) })}
              aria-label={dict.calendar.previousMonth}
              className="flex size-11 flex-none items-center justify-center rounded-md border border-line bg-surface text-ink hover:bg-hover"
            >
              <Icon name="chevronLeft" className="h-4 w-4" />
            </Link>
            <Link
              href={panelHref(ROUTES.reports, { month: nextIsoMonth(month) })}
              aria-label={dict.calendar.nextMonth}
              className="flex size-11 flex-none items-center justify-center rounded-md border border-line bg-surface text-ink hover:bg-hover"
            >
              <Icon name="chevronRight" className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatCard
              key={stat.key}
              icon={stat.icon}
              accent={stat.accent}
              label={stat.label}
              value={stat.value}
              hint={stat.hint}
              highlight={stat.highlight}
              delta={
                <TrendChip delta={stat.delta} dict={dict} sentiment={stat.sentiment} />
              }
              comparison={stat.comparison}
            />
          ))}
        </div>

        {/*
          The chart answers "which week was expensive" and the panel answers "why
          that one", so on a desk they sit side by side rather than a scroll
          apart. 7/5 because a six-bar chart needs the width and a five-row table
          does not.
        */}
        <div className="contents lg:flex lg:items-stretch lg:gap-3.5">
          <div className="lg:min-w-0 lg:basis-0 lg:grow-[7]">
            <WeeklyCostChart
              title={dict.reports.weeklyChart}
              bars={buildChartBars(report, dict)}
              selectedIndex={selectedIndex}
              average={{
                value: report.averageWeeklyCost,
                label: dict.reports.monthlyAverage,
                valueLabel: formatMoney(report.averageWeeklyCost),
              }}
              partialSuffix={dict.reports.partial}
              emptyLabel={dict.reports.empty}
            />
          </div>

          <div className="lg:min-w-0 lg:basis-0 lg:grow-[5]">
            <WeekComparisonPanel
              title={dict.reports.weekDetail}
              weekLabel={selectedWeekLabel(report, selectedIndex, dict)}
              weeks={buildWeekSegments(report, dict, selectedIndex)}
              rows={buildComparisonRows(report, selectedIndex, dict)}
              columnLabels={{
                week: dict.reports.thisWeek,
                month: dict.reports.monthlyAverage,
              }}
              partialNotice={selectedWeekPartialNotice(report, selectedIndex, dict)}
              dict={dict}
            />
          </div>
        </div>

        <div className="contents lg:flex lg:items-start lg:gap-3.5">
          <SectionBlock
            className="lg:min-w-0 lg:basis-0 lg:grow-[6]"
            title={dict.reports.weekTable}
            meta={weeksWithDataLabel(report, dict)}
          >
            <WeekCostTable
              rows={buildWeekRows(report, dict, selectedIndex)}
              labels={{
                week: dict.reports.colWeek,
                range: dict.reports.colRange,
                cost: dict.reports.colCost,
                hours: dict.reports.colHours,
                rate: dict.reports.colRate,
                partial: dict.reports.partial,
                total: dict.reports.statCost,
              }}
              totalLabel={formatMoney(report.totals.cost)}
            />
          </SectionBlock>

          <div className="lg:min-w-0 lg:basis-0 lg:grow-[6]">
            <EmployeeCostDonut
              title={`${dict.reports.distribution} · ${formatMonthName(month, dict)}`}
              slices={buildDonutSlices(report, dict, locale)}
              total={{
                label: dict.reports.total,
                valueLabel: formatMoney(report.totals.cost),
              }}
              emptyLabel={dict.reports.empty}
            />
          </div>
        </div>

        {/*
          Three footnotes, because three of this page's rules are invisible in
          its numbers: what the deltas are measured against, how a boundary week
          is counted, and that a historical month is priced at today's rates.
        */}
        <div className="flex flex-col gap-1.5">
          <Hint icon="info">{dict.reports.comparisonNote}</Hint>
          <Hint icon="info">{dict.reports.partialNote}</Hint>
          <Hint icon="info">{dict.reports.rateNote}</Hint>
        </div>
      </section>
    </PageShell>
  );
}
