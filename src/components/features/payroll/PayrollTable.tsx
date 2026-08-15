import { employeeDisplayName, employeePosition } from "@/lib/employee";
import { formatHours, formatHoursValue, formatMoney } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { PayrollReport } from "@/server/services/payroll.service";
import type { Locale } from "@/types/domain";

const COLUMNS = "grid grid-cols-[1fr_52px_56px_78px] gap-1.5 px-4";

export interface PayrollTableProps {
  report: PayrollReport;
  dict: Dictionary;
  locale: Locale;
}

export function PayrollTable({ report, dict, locale }: PayrollTableProps) {
  const totalLabel =
    report.period === "month" ? dict.team.costMonthly : dict.team.costWeekly;

  return (
    <div>
      <div
        className={cn(
          COLUMNS,
          "border-b border-line border-t-2 border-t-ink py-2 text-2xs font-bold uppercase tracking-[0.06em] text-muted",
        )}
      >
        <span>{dict.team.colStaff}</span>
        <span className="text-right">{dict.team.colHours}</span>
        <span className="text-right">{dict.team.colRate}</span>
        <span className="text-right">{dict.team.colTotal}</span>
      </div>

      <ul>
        {report.lines.map((line) => {
          const hasOvertime = line.overtimeHours > 0;

          return (
            <li
              key={line.employee.id}
              className={cn(
                COLUMNS,
                "items-center border-b border-line py-2.5",
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

      <div className="flex items-center justify-between border-b-2 border-ink bg-brand px-4 py-3.5 text-white">
        <span className="text-xs font-bold uppercase tracking-[0.1em]">{totalLabel}</span>
        <span className="tabular text-2xl font-extrabold">{formatMoney(report.totalCost)}</span>
      </div>
    </div>
  );
}
