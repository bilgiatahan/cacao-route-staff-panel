import type { ReactNode } from "react";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

/**
 * The card family's table: a tinted column strip, hairline-separated rows and a
 * brand-coloured total bar. Payroll and the staff earnings breakdown share it,
 * so the two read as the same object rather than two tables that look alike.
 *
 * Column widths stay with the caller — every table has its own — and are passed
 * as one grid class to both `TableHead` and each row via `TABLE_ROW`.
 */
export function TableCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <Card className={cn("overflow-hidden", className)}>{children}</Card>;
}

/** Row chrome shared by every body row; combine with the table's column class. */
export const TABLE_ROW = "items-center border-b border-line";

export interface TableHeadProps {
  /** The grid class the rows use too, so the columns actually line up. */
  columns: string;
  children: ReactNode;
}

export function TableHead({ columns, children }: TableHeadProps) {
  return (
    <div
      className={cn(
        "border-b border-line bg-fill py-2 text-2xs font-bold uppercase tracking-[0.06em] text-muted",
        columns
      )}
    >
      {children}
    </div>
  );
}

/** The dark bar closing a table: what everything above it adds up to. */
export function TableTotal({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-brand px-3.5 py-3.5 text-white">
      <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
      <span className="tabular text-lg font-extrabold">{value}</span>
    </div>
  );
}
