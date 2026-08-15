import {
  TABLE_ROW,
  TableCard,
  TableHead,
  TableTotal,
} from "@/components/ui/TableCard";
import { employeeDisplayName, employeePosition } from "@/lib/employee";
import { formatHours, formatHoursValue, formatMoney } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { PayrollReport } from "@/server/services/payroll.service";
import type { Locale } from "@/types/domain";

const COLUMNS = "grid grid-cols-[1fr_52px_56px_78px] gap-1.5 px-3.5";

export interface PayrollTableProps {
  report: PayrollReport;
  dict: Dictionary;
  locale: Locale;
}

export function PayrollTable({ report, dict, locale }: PayrollTableProps) {
  const totalLabel =
    report.period === "month" ? dict.team.costMonthly : dict.team.costWeekly;

  return (
    <TableCard>
      <TableHead columns={COLUMNS}>
        <span>{dict.team.colStaff}</span>
        <span className="text-right">{dict.team.colHours}</span>
        <span className="text-right">{dict.team.colRate}</span>
        <span className="text-right">{dict.team.colTotal}</span>
      </TableHead>

      <ul>
        {report.lines.map((line) => {
          const hasOvertime = line.overtimeHours > 0;

          return (
            <li
              key={line.employee.id}
              className={cn(
                COLUMNS,
                TABLE_ROW,
                "py-2.5",
                hasOvertime ? "bg-surface-warn" : "bg-surface",
              )}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {employeeDisplayName(line.employee, locale)}
                </div>
                <div
                  className={cn(
                    "text-2xs",
                    hasOvertime ? "text-warn-dark" : "text-muted-soft",
                  )}
                >
                  {hasOvertime
                    ? `+${formatHoursValue(line.overtimeHours)}${dict.units.hourSuffix} ${dict.team.overtime}`
                    : employeePosition(line.employee, locale)}
                </div>
              </div>
              <span className="tabular text-right text-sm">
                {formatHours(line.hours, dict)}
              </span>
              <span className="tabular text-right text-sm text-muted">{line.hourlyRate}</span>
              <span className="tabular text-right text-sm font-bold">
                {formatMoney(line.total)}
              </span>
            </li>
          );
        })}
      </ul>

      <TableTotal label={totalLabel} value={formatMoney(report.totalCost)} />
    </TableCard>
  );
}
