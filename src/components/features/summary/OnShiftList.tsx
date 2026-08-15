import { EmptyState, RuledList } from "@/components/ui/Section";
import { employeeDisplayName, employeePosition } from "@/lib/employee";
import { formatHours, formatShiftSpan } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { OnShiftToday } from "@/server/services/summary.service";
import type { Locale } from "@/types/domain";

export interface OnShiftListProps {
  rows: OnShiftToday[];
  dict: Dictionary;
  locale: Locale;
  /** Highlights the signed-in employee's own row. */
  highlightEmployeeId?: string;
}

export function OnShiftList({ rows, dict, locale, highlightEmployeeId }: OnShiftListProps) {
  if (rows.length === 0) {
    return (
      <RuledList>
        <EmptyState>{dict.summary.todayEmpty}</EmptyState>
      </RuledList>
    );
  }

  return (
    <RuledList>
      <ul>
        {rows.map(({ employee, shift }) => {
          const mine = employee.id === highlightEmployeeId;

          return (
            <li key={employee.id} className="flex items-center gap-3 px-4 py-3.5">
              <span
                aria-hidden
                className={cn("h-[34px] w-1.5 flex-none", mine ? "bg-warn" : "bg-brand")}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-md font-semibold">
                  {employeeDisplayName(employee, locale)}
                </div>
                <div className="text-xs text-muted">{employeePosition(employee, locale)}</div>
              </div>
              <div className="flex-none text-right">
                <div className="tabular text-sm font-bold">{formatShiftSpan(shift, dict)}</div>
                <div className="tabular text-xs text-muted">
                  {formatHours((shift.endMinutes - shift.startMinutes) / 60, dict)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </RuledList>
  );
}
