import { Avatar } from "@/components/ui/Avatar";
import { accentForId, Card, ACCENT_EDGE } from "@/components/ui/Card";
import { employeeDisplayName, employeeInitials, employeePosition } from "@/lib/employee";
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
      <Card className="px-4 py-4">
        <p className="text-sm text-muted-soft">{dict.summary.todayEmpty}</p>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map(({ employee, shift }) => {
        const mine = employee.id === highlightEmployeeId;
        const accent = accentForId(employee.id);

        return (
          <li key={employee.id}>
            <Card
              className={cn(
                "flex items-center gap-2.5 border-l-[3px] py-2.5 pl-2.5 pr-3",
                ACCENT_EDGE[accent],
                mine && "bg-brand-faint",
              )}
            >
              <Avatar
                initials={employeeInitials(employee, locale)}
                tone={accent}
                className="rounded-md"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-md font-semibold">
                  {employeeDisplayName(employee, locale)}
                </div>
                <div className="truncate text-xs text-muted">
                  {employeePosition(employee, locale)}
                </div>
              </div>
              <div className="tabular flex-none text-sm font-semibold">
                {formatShiftSpan(shift, dict)}
              </div>
              <div className="tabular w-9 flex-none text-right text-sm text-muted">
                {formatHours((shift.endMinutes - shift.startMinutes) / 60, dict)}
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
