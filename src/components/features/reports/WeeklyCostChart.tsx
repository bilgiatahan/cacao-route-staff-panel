import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/Section";
import { cn } from "@/lib/utils";

import { barGeometry, referencePercent } from "./chart-geometry";

export interface WeeklyCostBar {
  key: string;
  /** "W3" / "H3" — the short spine label under the bar. */
  shortLabel: string;
  /** "10 – 16 Ağu" — the date range under that. */
  rangeLabel: string;
  /** Already formatted, e.g. "£2,508.75". */
  valueLabel: string;
  /** The raw figure, used only for the bar's height. */
  value: number;
  isPartial: boolean;
  /** Selecting a bar drives the detail panel beside it. */
  href: string;
  /** Complete sentence for assistive tech — the bar's shape is not readable. */
  ariaLabel: string;
}

export interface WeeklyCostChartProps {
  title: string;
  bars: WeeklyCostBar[];
  selectedIndex: number;
  /** The monthly-average reference line. */
  average: { value: number; label: string; valueLabel: string };
  partialSuffix: string;
  emptyLabel: string;
}

/**
 * Cost per week, as a bar chart drawn in HTML.
 *
 * No SVG and no library: the bars are flex columns with a percentage height, so
 * they reflow with the card, the labels are real text a screen reader and a
 * find-in-page both reach, and nothing ships to the browser. Each bar is a link
 * that selects the week in the panel beside it, which keeps the selection in the
 * URL and the whole page a Server Component.
 *
 * The domain starts at zero — `barGeometry` enforces it — because a bar chart of
 * money with a floating baseline turns a 3% difference into a cliff.
 */
export function WeeklyCostChart({
  title,
  bars,
  selectedIndex,
  average,
  partialSuffix,
  emptyLabel,
}: WeeklyCostChartProps) {
  const geometry = barGeometry(
    bars.map((bar) => bar.value),
    selectedIndex,
  );
  const averageLine = referencePercent(
    average.value,
    bars.map((bar) => bar.value),
  );
  const hasData = bars.some((bar) => bar.value > 0);

  return (
    <Card padding="md" className="flex min-w-0 flex-col gap-3">
      <SectionHeading variant="plain" title={title} className="mb-0 pb-0 pt-0" />

      {hasData ? (
        <div className="relative flex h-64 items-end gap-1.5 sm:gap-2.5">
          {/*
            The average line sits behind the bars and spans the plot, with its
            value labelled at the right edge so the line means something without
            a legend to cross-reference.
          */}
          {averageLine !== null ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 z-0 flex items-center"
              style={{ bottom: `calc(${averageLine}% * 0.82)` }}
            >
              <div className="h-0 flex-1 border-t border-dashed border-brand/45" />
              <span className="ml-1 rounded-sm border border-line bg-surface px-1.5 py-0.5 text-2xs leading-tight text-muted">
                <span className="block font-semibold">{average.label}</span>
                <span className="tabular block">{average.valueLabel}</span>
              </span>
            </div>
          ) : null}

          {bars.map((bar, index) => (
            <Link
              key={bar.key}
              href={bar.href}
              aria-label={bar.ariaLabel}
              aria-current={geometry[index].isSelected ? "true" : undefined}
              className="group relative z-10 flex h-full min-w-0 flex-1 flex-col justify-end gap-1.5 rounded-md pb-0 focus-visible:outline-offset-2"
            >
              <span
                aria-hidden
                className={cn(
                  "tabular text-center text-2xs font-semibold",
                  geometry[index].isSelected ? "text-ink" : "text-muted",
                )}
              >
                {bar.valueLabel}
              </span>

              {/* 82% of the column is plot; the rest is the value label above. */}
              <span
                aria-hidden
                style={{ height: `${geometry[index].heightPercent * 0.82}%` }}
                className={cn(
                  "w-full rounded-t-sm transition-colors",
                  geometry[index].isSelected
                    ? "bg-brand"
                    : "bg-brand-soft group-hover:bg-brand/45",
                  // A partial week is hatched, so "short week" is a texture and
                  // not only a footnote in the table below.
                  bar.isPartial &&
                    "bg-[repeating-linear-gradient(135deg,var(--color-brand-soft)_0_5px,transparent_5px_10px)] ring-1 ring-inset ring-brand/30",
                  bar.isPartial && geometry[index].isSelected && "ring-brand",
                )}
              />
            </Link>
          ))}
        </div>
      ) : (
        <p className="flex h-64 items-center justify-center text-sm text-muted">
          {emptyLabel}
        </p>
      )}

      <div className="flex gap-1.5 border-t border-line pt-2 sm:gap-2.5">
        {bars.map((bar, index) => (
          <div key={bar.key} className="min-w-0 flex-1 text-center">
            <div
              className={cn(
                "truncate text-xs font-bold",
                index === selectedIndex ? "text-ink underline" : "text-muted",
              )}
            >
              {bar.shortLabel}
            </div>
            <div className="truncate text-2xs text-muted">{bar.rangeLabel}</div>
            {bar.isPartial ? (
              <div className="truncate text-nano uppercase tracking-wide text-muted">
                {partialSuffix}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
