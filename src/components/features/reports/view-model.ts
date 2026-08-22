import type { Accent } from "@/components/ui/Card";
import type { IconName } from "@/components/ui/Icon";
import type { SegmentOption } from "@/components/ui/SegmentedControl";
import { todayIso } from "@/lib/date";
import type { Delta, MonthlyCostReport } from "@/lib/domain/monthly-cost";
import { localizedText } from "@/lib/employee";
import {
  formatCount,
  formatHours,
  formatMoney,
  formatMonthName,
  formatWeekSpan,
  formatSignedPercent,
} from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { panelHref, ROUTES } from "@/lib/routes";
import type { IsoDate, Locale } from "@/types/domain";

import type { EmployeeCostSlice } from "./EmployeeCostDonut";
import type { ComparisonRow } from "./WeekComparisonPanel";
import type { WeekCostRow } from "./WeekCostTable";
import type { WeeklyCostBar } from "./WeeklyCostChart";
import type { TrendSentiment } from "./TrendChip";

/**
 * `MonthlyCostReport` → finished strings.
 *
 * The report model is deliberately numbers-only; every currency symbol, month
 * name and percentage sign is decided here, once, on the server. That keeps the
 * page declarative and — more usefully — makes the labelling testable without a
 * DOM, which is where the interesting mistakes live: a percentage that reads
 * "-0.0%", a dash that should have been a zero, a boundary week whose label
 * claims days it did not count.
 *
 * Nothing here recomputes a business figure. Every number comes off the report
 * exactly as the domain produced it.
 */

/**
 * "2 days in this month" / "1 day in this month".
 *
 * English inflects the noun after a numeral and Turkish does not, so both forms
 * are dictionary keys rather than a suffix bolted on in code — `tr` sets them to
 * the same string, which is the correct answer there and not a duplication bug.
 */
function daysInMonthLabel(days: number, dict: Dictionary): string {
  return `${days} ${days === 1 ? dict.reports.partialDay : dict.reports.partialDays}`;
}

/** "W3" / "H3" — short enough for a chart spine. */
export function weekShortLabel(index: number, dict: Dictionary): string {
  return `${dict.reports.weekPrefix}${index + 1}`;
}

/**
 * Which week the detail panel opens on.
 *
 * An explicit `?week=` wins. Failing that: the week containing today, so a
 * mid-month visit lands on the week the reader is living in; then the most
 * recent week with any data, so a past month opens somewhere useful rather than
 * on an empty leading sliver; then the first week.
 */
export function resolveSelectedWeekIndex(
  report: MonthlyCostReport,
  weekParam: string | undefined,
): number {
  const explicit = report.weeks.findIndex((week) => week.weekStart === weekParam);
  if (explicit !== -1) return explicit;

  const today = todayIso();
  const containingToday = report.weeks.findIndex(
    (week) => week.rangeStart <= today && week.rangeEnd >= today,
  );
  if (containingToday !== -1) return containingToday;

  const lastWithData = report.weeks.reduce(
    (found, week, index) => (week.totals.hours > 0 ? index : found),
    -1,
  );
  return lastWithData === -1 ? 0 : lastWithData;
}

function weekHref(month: string, weekStart: IsoDate): string {
  return panelHref(ROUTES.reports, { month, week: weekStart });
}

/* ------------------------------------------------------------- stat cards -- */

export interface StatCardView {
  key: string;
  icon: IconName;
  accent: Accent;
  label: string;
  value: string;
  hint: string;
  delta: Delta | null;
  sentiment: TrendSentiment;
  /** The previous month's own figure, spelled out. */
  comparison: string;
  highlight?: boolean;
}

export function buildStatCards(
  report: MonthlyCostReport,
  dict: Dictionary,
): StatCardView[] {
  const monthLabel = formatMonthName(report.month, dict);
  const previous = report.previousMonth;
  const previousLabel = previous ? formatMonthName(previous.month, dict) : null;

  /** "Temmuz 2026: £9,110.75", or a plain note when there is no baseline. */
  const baseline = (value: string | null): string =>
    previousLabel && value !== null
      ? `${previousLabel}: ${value}`
      : dict.reports.noPrevious;

  const rate = report.totals.averageHourlyCost;
  const previousRate = previous?.totals.averageHourlyCost ?? null;

  return [
    {
      key: "cost",
      icon: "pay",
      accent: "green",
      label: dict.reports.statCost,
      value: formatMoney(report.totals.cost),
      hint: monthLabel,
      delta: previous?.costChange ?? null,
      // A wage bill going up is not an achievement, so it is not painted as one.
      sentiment: "lowerIsBetter",
      comparison: baseline(previous ? formatMoney(previous.totals.cost) : null),
    },
    {
      key: "hours",
      icon: "clock",
      accent: "blue",
      label: dict.reports.statHours,
      value: formatHours(report.totals.hours, dict),
      hint: monthLabel,
      delta: previous?.hoursChange ?? null,
      // Volume, with no verdict attached — more hours is neither good nor bad.
      sentiment: "neutral",
      comparison: baseline(previous ? formatHours(previous.totals.hours, dict) : null),
    },
    {
      key: "rate",
      icon: "rate",
      accent: "violet",
      label: dict.reports.statRate,
      value: rate === null ? dict.common.dash : `${formatMoney(rate)}${dict.units.perHour}`,
      hint: monthLabel,
      delta: previous?.averageHourlyCostChange ?? null,
      sentiment: "lowerIsBetter",
      comparison: baseline(
        previousRate === null
          ? null
          : `${formatMoney(previousRate)}${dict.units.perHour}`,
      ),
    },
    {
      key: "gaps",
      icon: "calendarCheck",
      accent: "amber",
      label: dict.reports.statGaps,
      value: String(report.gapDays),
      hint: monthLabel,
      delta: previous?.gapDaysChange ?? null,
      sentiment: "lowerIsBetter",
      comparison: baseline(previous ? String(previous.gapDays) : null),
      highlight: report.gapDays > 0,
    },
    {
      key: "staff",
      icon: "team",
      accent: "rose",
      label: dict.reports.statStaff,
      value: String(report.activeStaffCount),
      hint: monthLabel,
      delta: previous?.activeStaffCountChange ?? null,
      sentiment: "neutral",
      comparison: baseline(previous ? String(previous.activeStaffCount) : null),
    },
  ];
}

/* ----------------------------------------------------------- weekly charts -- */

export function buildChartBars(
  report: MonthlyCostReport,
  dict: Dictionary,
): WeeklyCostBar[] {
  return report.weeks.map((week, index) => {
    const range = formatWeekSpan(week.weekStart, week.weekEnd, dict);
    const short = weekShortLabel(index, dict);

    return {
      key: week.weekStart,
      shortLabel: short,
      rangeLabel: range,
      valueLabel: formatMoney(week.totals.cost),
      value: week.totals.cost,
      isPartial: week.isPartial,
      href: weekHref(report.month, week.weekStart),
      // The bar's height is not readable, so the sentence carries everything:
      // which week, how much, how long, and whether it was a clipped week.
      ariaLabel: [
        `${short} ${range}`,
        formatMoney(week.totals.cost),
        formatHours(week.totals.hours, dict),
        week.isPartial
          ? daysInMonthLabel(week.daysInMonth, dict)
          : dict.reports.partialFull,
      ].join(" · "),
    };
  });
}

export function buildWeekRows(
  report: MonthlyCostReport,
  dict: Dictionary,
  selectedIndex: number,
): WeekCostRow[] {
  return report.weeks.map((week, index) => {
    const range = formatWeekSpan(week.weekStart, week.weekEnd, dict);
    const short = weekShortLabel(index, dict);
    const rate = week.totals.averageHourlyCost;

    return {
      key: week.weekStart,
      shortLabel: short,
      rangeLabel: range,
      costLabel: formatMoney(week.totals.cost),
      hoursLabel: formatHours(week.totals.hours, dict),
      rateLabel: rate === null ? dict.common.dash : formatMoney(rate),
      gapLabel: String(week.gapDays),
      isPartial: week.isPartial,
      isSelected: index === selectedIndex,
      href: weekHref(report.month, week.weekStart),
      ariaLabel: [
        `${short} ${range}`,
        `${dict.reports.colCost} ${formatMoney(week.totals.cost)}`,
        `${dict.reports.colHours} ${formatHours(week.totals.hours, dict)}`,
        `${dict.reports.colGaps} ${week.gapDays}`,
        week.isPartial ? daysInMonthLabel(week.daysInMonth, dict) : "",
      ]
        .filter(Boolean)
        .join(" · "),
    };
  });
}

export function buildWeekSegments(
  report: MonthlyCostReport,
  dict: Dictionary,
  selectedIndex: number,
): SegmentOption[] {
  return report.weeks.map((week, index) => ({
    key: week.weekStart,
    label: weekShortLabel(index, dict),
    href: weekHref(report.month, week.weekStart),
    active: index === selectedIndex,
  }));
}

/* ------------------------------------------------------- week vs the month -- */

/**
 * The selected week beside the month's own averages.
 *
 * The baseline is the *average* week, not the whole month, so the two columns
 * are commensurable: comparing one week's £2,508 against a month's £10,246 would
 * report a 75% shortfall every single time.
 */
export function buildComparisonRows(
  report: MonthlyCostReport,
  selectedIndex: number,
  dict: Dictionary,
): ComparisonRow[] {
  const week = report.weeks[selectedIndex];
  if (!week) return [];

  const monthRate = report.totals.averageHourlyCost;
  const weekRate = week.totals.averageHourlyCost;

  const against = (current: number, average: number): Delta | null =>
    average === 0
      ? current === 0
        ? { absolute: 0, percent: null }
        : { absolute: current, percent: null }
      : { absolute: current - average, percent: ((current - average) / average) * 100 };

  return [
    {
      key: "cost",
      label: dict.reports.rowCost,
      weekValue: formatMoney(week.totals.cost),
      monthValue: formatMoney(report.averageWeeklyCost),
      delta: against(week.totals.cost, report.averageWeeklyCost),
      sentiment: "lowerIsBetter",
    },
    {
      key: "hours",
      label: dict.reports.rowHours,
      weekValue: formatHours(week.totals.hours, dict),
      monthValue: formatHours(report.averageWeeklyHours, dict),
      delta: against(week.totals.hours, report.averageWeeklyHours),
      sentiment: "neutral",
    },
    {
      key: "rate",
      label: dict.reports.rowRate,
      weekValue:
        weekRate === null ? dict.common.dash : `${formatMoney(weekRate)}${dict.units.perHour}`,
      monthValue:
        monthRate === null
          ? dict.common.dash
          : `${formatMoney(monthRate)}${dict.units.perHour}`,
      delta:
        weekRate === null || monthRate === null ? null : against(weekRate, monthRate),
      sentiment: "lowerIsBetter",
    },
    {
      key: "gaps",
      label: dict.reports.rowGaps,
      weekValue: String(week.gapDays),
      monthValue: formatCount(report.gapDays / Math.max(1, report.weeksInMonth)),
      delta: against(week.gapDays, report.gapDays / Math.max(1, report.weeksInMonth)),
      sentiment: "lowerIsBetter",
    },
    {
      key: "staff",
      label: dict.reports.rowStaff,
      weekValue: String(week.activeStaffCount),
      monthValue: formatCount(report.averageWeeklyStaffCount),
      delta: against(week.activeStaffCount, report.averageWeeklyStaffCount),
      sentiment: "neutral",
    },
  ];
}

/** "10 – 16 Ağu · W3" — the selected week, spelled out. */
export function selectedWeekLabel(
  report: MonthlyCostReport,
  selectedIndex: number,
  dict: Dictionary,
): string {
  const week = report.weeks[selectedIndex];
  if (!week) return dict.common.dash;
  return `${formatWeekSpan(week.weekStart, week.weekEnd, dict)} · ${weekShortLabel(
    selectedIndex,
    dict,
  )}`;
}

/** "2 gün bu ayda" for a clipped week, `null` for a whole one. */
export function selectedWeekPartialNotice(
  report: MonthlyCostReport,
  selectedIndex: number,
  dict: Dictionary,
): string | null {
  const week = report.weeks[selectedIndex];
  if (!week?.isPartial) return null;
  return daysInMonthLabel(week.daysInMonth, dict);
}

/* ---------------------------------------------------------------- employees -- */

export function buildDonutSlices(
  report: MonthlyCostReport,
  dict: Dictionary,
  locale: Locale,
): EmployeeCostSlice[] {
  return report.employees.map((line) => ({
    employeeId: line.employeeId,
    name: line.name,
    position: localizedText(line.position, locale),
    costLabel: formatMoney(line.cost),
    shareLabel:
      line.shareOfCost === null
        ? dict.common.dash
        : formatSignedPercent(line.shareOfCost, dict).replace("+", ""),
    cost: line.cost,
  }));
}

/** "5 / 6 hafta" — how much of the month actually carried data. */
export function weeksWithDataLabel(report: MonthlyCostReport, dict: Dictionary): string {
  return `${report.weeksWithData} ${dict.reports.ofWeeks} ${report.weeksInMonth} ${dict.reports.weeksWithData}`;
}
