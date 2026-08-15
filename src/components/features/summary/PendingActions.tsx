import Link from "next/link";

import { ACCENT_EDGE, Card } from "@/components/ui/Card";
import { employeeDisplayName } from "@/lib/employee";
import { fromIsoDate } from "@/lib/date";
import { formatDateRange, formatShiftSpan } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { panelHref, ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { Employee, IsoDate, LeaveRequest, Locale, Shift, SwapRequest } from "@/types/domain";

export interface PendingActionsProps {
  leaveRequests: LeaveRequest[];
  swapRequests: SwapRequest[];
  employees: Employee[];
  shifts: Shift[];
  dict: Dictionary;
  locale: Locale;
  weekStart: IsoDate;
}

interface ActionRow {
  key: string;
  title: string;
  subtitle: string;
  warn: boolean;
}

/** Requests waiting on the manager, shown as a short worklist on the summary. */
export function PendingActions({
  leaveRequests,
  swapRequests,
  employees,
  shifts,
  dict,
  locale,
  weekStart,
}: PendingActionsProps) {
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const nameOf = (id: string) => {
    const employee = byId.get(id);
    return employee ? employeeDisplayName(employee, locale) : dict.common.dash;
  };
  const dayNameOf = (date: IsoDate) => {
    const index = fromIsoDate(date).getDay();
    return dict.calendar.daysLong[index === 0 ? 6 : index - 1];
  };

  const rows: ActionRow[] = [
    ...leaveRequests.slice(0, 3).map((request) => ({
      key: `leave-${request.id}`,
      title: `${nameOf(request.employeeId)} · ${dict.leave.types[request.type]}`,
      subtitle: `${formatDateRange(request.startDate, request.endDate, dict)} · ${dict.summary.requested}`,
      warn: true,
    })),
    ...swapRequests.map((request) => {
      const shift =
        shifts.find(
          (item) => item.employeeId === request.requesterId && item.date === request.date,
        ) ?? null;

      return {
        key: `swap-${request.id}`,
        title: `${nameOf(request.requesterId)} ↔ ${nameOf(request.targetId)}`,
        subtitle: `${dayNameOf(request.date)} · ${formatShiftSpan(shift, dict)}`,
        warn: false,
      };
    }),
  ];

  if (rows.length === 0) {
    return (
      <Card className="px-4 py-4">
        <p className="text-sm text-muted-soft">{dict.summary.needsActionEmpty}</p>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.key}>
          <Card
            className={cn(
              "flex items-center gap-3 border-l-[3px] py-2.5 pl-3 pr-2.5",
              row.warn ? ACCENT_EDGE.amber : ACCENT_EDGE.blue,
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-md font-semibold">{row.title}</div>
              <div className="truncate text-xs text-muted">{row.subtitle}</div>
            </div>
            <Link
              href={panelHref(ROUTES.leave, { week: weekStart })}
              className="flex-none rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-xs font-bold text-ink hover:bg-hover"
            >
              {dict.common.view}
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  );
}
