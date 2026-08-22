import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/Section";
import { SegmentedControl, type SegmentOption } from "@/components/ui/SegmentedControl";
import type { Dictionary } from "@/lib/i18n";
import type { Delta } from "@/lib/domain/monthly-cost";

import { TrendChip, type TrendSentiment } from "./TrendChip";

export interface ComparisonRow {
  key: string;
  label: string;
  /** Already formatted. */
  weekValue: string;
  monthValue: string;
  delta: Delta | null;
  sentiment?: TrendSentiment;
}

export interface WeekComparisonPanelProps {
  title: string;
  /** The selected week, spelled out: "10 – 16 Ağu 2026 · W3". */
  weekLabel: string;
  weeks: SegmentOption[];
  rows: ComparisonRow[];
  columnLabels: { week: string; month: string };
  /** Rendered when the selected week is a clipped boundary week. */
  partialNotice: string | null;
  dict: Dictionary;
}

/**
 * One week against the month's own average.
 *
 * The week is chosen by link, not by a dropdown: the selection lands in the URL,
 * so the panel is shareable, survives the back button, and the whole page stays
 * a Server Component with no client JavaScript. Six short segments read as a
 * spine of weeks, which the mockup's `<select>` could not show at a glance.
 *
 * A three-column comparison is a table, so it is marked up as one — the header
 * cells are what let a screen reader say "This Week, £2,508.75" instead of
 * reading a wall of unattributed figures.
 */
export function WeekComparisonPanel({
  title,
  weekLabel,
  weeks,
  rows,
  columnLabels,
  partialNotice,
  dict,
}: WeekComparisonPanelProps) {
  return (
    <Card padding="md" className="flex min-w-0 flex-col gap-3">
      <SectionHeading variant="plain" title={title} className="mb-0 pb-0 pt-0" />

      <SegmentedControl ariaLabel={title} options={weeks} className="lg:w-full" />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{weekLabel}</span>
        {partialNotice ? <Badge tone="neutral">{partialNotice}</Badge> : null}
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="sr-only">
              {title}
            </th>
            <th
              scope="col"
              className="pb-1.5 text-right text-2xs font-bold uppercase tracking-[0.06em] text-muted"
            >
              {columnLabels.week}
            </th>
            <th
              scope="col"
              className="pb-1.5 text-right text-2xs font-bold uppercase tracking-[0.06em] text-muted"
            >
              {columnLabels.month}
            </th>
            <th scope="col" className="pb-1.5 pl-2 text-right">
              <span className="sr-only">{dict.reports.monthlyAverage}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-line last:border-0">
              <th scope="row" className="py-2.5 pr-2 text-left font-normal">
                {row.label}
              </th>
              <td className="tabular py-2.5 text-right font-bold">{row.weekValue}</td>
              <td className="tabular py-2.5 text-right text-muted">{row.monthValue}</td>
              <td className="py-2.5 pl-2 text-right">
                <span className="inline-flex justify-end">
                  <TrendChip delta={row.delta} dict={dict} sentiment={row.sentiment} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
