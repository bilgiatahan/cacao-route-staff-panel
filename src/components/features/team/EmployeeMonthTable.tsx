import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Section";
import { TABLE_ROW, TableCard, TableHead, TableTotal } from "@/components/ui/TableCard";
import type { EmployeeMonth } from "@/lib/domain/employee-month";
import { formatHours, formatMoney, formatWeekSpan } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { IsoDate } from "@/types/domain";

/**
 * One template for the head and every row, so the columns cannot desync — the
 * same arrangement `PayrollTable` uses, with the person column replaced by the
 * week range. `minmax(0,…)` on the first track so the "this week" chip cannot
 * push the figures off a 360px phone.
 */
const COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_64px_84px] gap-1.5 px-3.5 " +
  "lg:grid-cols-[minmax(0,1fr)_96px_128px] lg:gap-3 lg:px-4";

export interface EmployeeMonthTableProps {
  month: EmployeeMonth;
  dict: Dictionary;
  /**
   * Today, when it falls inside this month — marks the week you are living in.
   *
   * Passed rather than read here, the same way `WeekShiftList` takes it: a
   * component that decides for itself what "now" is cannot be rendered for any
   * other moment, and the two screens using this table already know the date.
   */
  today?: IsoDate;
}

/**
 * The month, week by week: what each week of it came to for one person.
 *
 * Every week touching the month is listed, including the ones with no shifts,
 * because an empty week is a fact about the month rather than a gap in the
 * table — a run of dashes is how a quiet fortnight looks. A month with *no*
 * shifts at all is a different statement, and gets an empty state instead of six
 * rows of dashes that say the same thing six times.
 *
 * Each row is labelled by the part of the week that is **inside** the month
 * (`rangeStart`–`rangeEnd`), not by the week's real Monday-to-Sunday span. The
 * monthly report does the opposite, and is right to: there a week is a unit
 * being compared against other weeks, so it keeps its true identity and carries
 * a "partial" marker. Here the label has one job — saying which days produced
 * the figures beside it — so "1–2 Ağu" is the honest heading for a boundary
 * week and needs no marker to explain itself.
 */
export function EmployeeMonthTable({ month, dict, today }: EmployeeMonthTableProps) {
  if (month.hours === 0) {
    return (
      <Card>
        <EmptyState icon="timetable">{dict.team.noMonthEarnings}</EmptyState>
      </Card>
    );
  }

  return (
    <TableCard>
      <TableHead columns={COLUMNS}>
        <span>{dict.team.colWeek}</span>
        <span className="text-right">{dict.team.colHours}</span>
        <span className="text-right">{dict.team.colTotal}</span>
      </TableHead>

      <ul>
        {month.weeks.map((week) => {
          const worked = week.hours > 0;
          // ISO dates compare lexicographically, so this is a date range test.
          const isCurrent =
            today !== undefined && today >= week.rangeStart && today <= week.rangeEnd;

          return (
            <li
              key={week.weekStart}
              // The row the week block on this page is showing. The tint places
              // it; the chip names it, because a tint alone is not a label.
              aria-current={isCurrent ? "true" : undefined}
              className={cn(
                COLUMNS,
                TABLE_ROW,
                "py-2.5",
                isCurrent ? "bg-brand-faint" : "bg-surface",
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="tabular truncate text-sm font-semibold">
                  {formatWeekSpan(week.rangeStart, week.rangeEnd, dict)}
                </span>
                {isCurrent && <Badge tone="info">{dict.calendar.thisWeek}</Badge>}
              </span>
              <span
                className={cn("tabular text-right text-sm", !worked && "text-muted")}
              >
                {worked ? formatHours(week.hours, dict) : dict.common.dash}
              </span>
              <span
                className={cn(
                  "tabular text-right text-sm",
                  worked ? "font-bold" : "text-muted",
                )}
              >
                {worked ? formatMoney(week.pay) : dict.common.dash}
              </span>
            </li>
          );
        })}
      </ul>

      <TableTotal label={dict.team.monthlyPay} value={formatMoney(month.pay)} />
    </TableCard>
  );
}
