import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/Section";
import { cn } from "@/lib/utils";

import { DONUT, donutSlices } from "./chart-geometry";

/** Ring colours, in order. Deliberately not `accentForId`: adjacent slices must
 *  differ, and a hash of the employee id can hand two neighbours the same hue. */
const SLICE_STROKE = [
  "stroke-brand",
  "stroke-accent-green",
  "stroke-accent-blue",
  "stroke-accent-violet",
  "stroke-accent-amber",
  "stroke-accent-rose",
  "stroke-brand-dark",
  "stroke-muted",
];

const SLICE_DOT = [
  "bg-brand",
  "bg-accent-green",
  "bg-accent-blue",
  "bg-accent-violet",
  "bg-accent-amber",
  "bg-accent-rose",
  "bg-brand-dark",
  "bg-muted",
];

export interface EmployeeCostSlice {
  employeeId: string;
  name: string;
  position: string;
  /** Already formatted, e.g. "£1,910.00". */
  costLabel: string;
  /** Already formatted, e.g. "25.2%", or the dash when the month cost nothing. */
  shareLabel: string;
  /** Raw figure, used only for the arc's length. */
  cost: number;
}

export interface EmployeeCostDonutProps {
  title: string;
  slices: EmployeeCostSlice[];
  total: { label: string; valueLabel: string };
  emptyLabel: string;
}

/**
 * Who the month's wage bill went to.
 *
 * Inline SVG, no library — one ring of stroked arcs, geometry from
 * `chart-geometry`. The legend is the real content: it carries the name, the
 * money and the share as text, in cost order, so the picture is a summary of the
 * list rather than the only place the numbers live. That is also what makes the
 * ring safe to draw with colour alone — nothing is encoded in the hue that is
 * not also written down two inches to the right.
 *
 * People beyond the palette's length share the last colour. That is a real
 * limitation and an honest one: a café roster is under ten people, and inventing
 * a ninth barely-distinguishable green would make the ring less readable, not
 * more.
 */
export function EmployeeCostDonut({
  title,
  slices,
  total,
  emptyLabel,
}: EmployeeCostDonutProps) {
  const arcs = donutSlices(slices.map((slice) => slice.cost));

  return (
    <Card padding="md" className="flex min-w-0 flex-col gap-3">
      <SectionHeading variant="plain" title={title} className="mb-0 pb-0 pt-0" />

      {slices.length === 0 || arcs.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-center lg:gap-5">
          <div className="relative flex-none">
            <svg
              viewBox={`0 0 ${DONUT.size} ${DONUT.size}`}
              className="h-40 w-40"
              role="img"
              aria-label={`${title}: ${total.valueLabel}`}
            >
              {/* The track, so a ring with one thin slice still reads as a ring. */}
              <circle
                cx={DONUT.center}
                cy={DONUT.center}
                r={DONUT.radius}
                fill="none"
                strokeWidth={DONUT.thickness}
                className="stroke-fill-strong"
              />
              {arcs.map((arc, index) =>
                arc.path ? (
                  <path
                    key={slices[index].employeeId}
                    d={arc.path}
                    fill="none"
                    strokeWidth={DONUT.thickness}
                    strokeLinecap="butt"
                    className={SLICE_STROKE[index % SLICE_STROKE.length]}
                  />
                ) : null,
              )}
            </svg>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xs uppercase tracking-[0.08em] text-muted">
                {total.label}
              </span>
              <span className="tabular text-sm font-extrabold">{total.valueLabel}</span>
            </div>
          </div>

          <ul className="flex w-full min-w-0 flex-1 flex-col gap-1">
            {slices.map((slice, index) => (
              <li
                key={slice.employeeId}
                className="flex min-w-0 items-baseline gap-2 text-xs"
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-1 size-2 flex-none rounded-sm",
                    SLICE_DOT[index % SLICE_DOT.length],
                  )}
                />
                <span className="min-w-0 flex-1 truncate font-semibold">{slice.name}</span>
                <span className="tabular flex-none font-bold">{slice.costLabel}</span>
                <span className="tabular w-11 flex-none text-right text-muted">
                  {slice.shareLabel}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
