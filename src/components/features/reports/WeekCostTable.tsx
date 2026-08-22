import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { TABLE_ROW, TableCard, TableHead, TableTotal } from "@/components/ui/TableCard";
import { cn } from "@/lib/utils";

/**
 * Six weeks and six numeric columns will not fit a 560px phone, so the phone
 * layout is a stacked card per week and the table proper appears from `sm`. One
 * grid class drives the head and every row, the rule `TableCard` is built on.
 */
const COLUMNS =
  "grid grid-cols-[38px_1fr_84px_58px] gap-1.5 px-3.5 " +
  "sm:grid-cols-[44px_1fr_96px_70px_88px_72px] sm:gap-2 sm:px-4";

export interface WeekCostRow {
  key: string;
  shortLabel: string;
  rangeLabel: string;
  costLabel: string;
  hoursLabel: string;
  rateLabel: string;
  gapLabel: string;
  isPartial: boolean;
  isSelected: boolean;
  href: string;
  /** Reads the whole row aloud; the columns alone are a list of bare numbers. */
  ariaLabel: string;
}

export interface WeekCostTableProps {
  rows: WeekCostRow[];
  labels: {
    week: string;
    range: string;
    cost: string;
    hours: string;
    rate: string;
    gaps: string;
    partial: string;
    total: string;
  };
  totalLabel: string;
}

export function WeekCostTable({ rows, labels, totalLabel }: WeekCostTableProps) {
  return (
    <TableCard>
      <TableHead columns={COLUMNS}>
        <span>{labels.week}</span>
        <span>{labels.range}</span>
        <span className="text-right">{labels.cost}</span>
        <span className="text-right">{labels.hours}</span>
        <span className="hidden text-right sm:block">{labels.rate}</span>
        <span className="hidden text-right sm:block">{labels.gaps}</span>
      </TableHead>

      <ul>
        {rows.map((row) => (
          <li key={row.key}>
            <Link
              href={row.href}
              aria-label={row.ariaLabel}
              aria-current={row.isSelected ? "true" : undefined}
              className={cn(
                COLUMNS,
                TABLE_ROW,
                "py-2.5 hover:bg-hover focus-visible:outline-offset-[-3px]",
                row.isSelected ? "bg-brand-faint" : "bg-surface",
              )}
            >
              <span
                className={cn(
                  "text-sm font-bold",
                  row.isSelected ? "text-brand-dark underline" : "text-muted",
                )}
              >
                {row.shortLabel}
              </span>

              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm">{row.rangeLabel}</span>
                {row.isPartial ? (
                  <Badge tone="neutral" className="hidden sm:inline-flex">
                    {labels.partial}
                  </Badge>
                ) : null}
              </span>

              <span className="tabular text-right text-sm font-bold">{row.costLabel}</span>
              <span className="tabular text-right text-sm">{row.hoursLabel}</span>
              <span className="tabular hidden text-right text-sm text-muted sm:block">
                {row.rateLabel}
              </span>
              <span className="tabular hidden text-right text-sm sm:block">
                {row.gapLabel}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <TableTotal label={labels.total} value={totalLabel} />
    </TableCard>
  );
}
