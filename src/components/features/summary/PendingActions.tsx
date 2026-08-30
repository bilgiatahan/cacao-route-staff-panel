import { ACCENT_EDGE, Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Section";
import { Icon } from "@/components/ui/Icon";
import { employeeDisplayName } from "@/lib/employee";
import { weekdayIndex } from "@/lib/date";
import { formatDateRange, formatShiftSpan } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { Employee, IsoDate, LeaveRequest, Shift, SwapRequest } from "@/types/domain";

export interface PendingActionsProps {
  leaveRequests: LeaveRequest[];
  swapRequests: SwapRequest[];
  employees: Employee[];
  shifts: Shift[];
  dict: Dictionary;
}

interface ActionRow {
  key: string;
  /** The kind of decision, named rather than implied by an edge colour. */
  kind: string;
  title: string;
  subtitle: string;
  warn: boolean;
}

/**
 * Requests waiting on the manager — the one block on this page that is a
 * worklist rather than a readout.
 *
 * Each row is the link, so the whole card is the target instead of a 28px "View"
 * button sitting next to it, and a `Badge` names the kind of request. Leave and
 * swap used to be told apart only by the colour of a 3px edge.
 */
export function PendingActions({
  leaveRequests,
  swapRequests,
  employees,
  shifts,
  dict,
}: PendingActionsProps) {
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const nameOf = (id: string) => {
    const employee = byId.get(id);
    return employee ? employeeDisplayName(employee) : dict.common.dash;
  };
  const dayNameOf = (date: IsoDate) => dict.calendar.daysLong[weekdayIndex(date)];

  const rows: ActionRow[] = [
    ...leaveRequests.slice(0, 3).map((request) => ({
      key: `leave-${request.id}`,
      kind: dict.leave.types[request.type],
      title: nameOf(request.employeeId),
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
        kind: dict.leave.swaps,
        title: `${nameOf(request.requesterId)} ↔ ${nameOf(request.targetId)}`,
        subtitle: `${dayNameOf(request.date)} · ${formatShiftSpan(shift, dict)}`,
        warn: false,
      };
    }),
  ];

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState icon="calendarCheck">{dict.summary.needsActionEmpty}</EmptyState>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.key}>
          <Card
            href={ROUTES.leave}
            padding="sm"
            className={cn(
              "flex items-center gap-3 border-l-4",
              row.warn ? ACCENT_EDGE.amber : ACCENT_EDGE.blue,
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-md font-semibold">{row.title}</span>
                <Badge tone={row.warn ? "warning" : "info"}>{row.kind}</Badge>
              </div>
              <div className="truncate text-xs text-muted">{row.subtitle}</div>
            </div>
            <Icon name="chevronRight" className="h-4 w-4 flex-none text-muted" />
          </Card>
        </li>
      ))}
    </ul>
  );
}
