import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { employeeDisplayName } from "@/lib/employee";
import { formatDateRange } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { actionErrorMessages } from "@/server/actions/action-result";
import { decideLeaveAction } from "@/server/actions/leave.actions";
import type { LeaveRow } from "@/server/services/leave.service";

import { DecisionButtons } from "./DecisionButtons";

export interface LeaveListProps {
  rows: LeaveRow[];
  dict: Dictionary;
}

/**
 * Leave requests, newest first.
 *
 * A row is not a link — a pending one carries the decision buttons, and the rest
 * lead nowhere — so the full-row-link rule from Summary does not apply here. The
 * leave type used to be plain text glued to the name with a middot; it is a
 * `Badge` now, which is what makes a list of mixed types scannable.
 */
export function LeaveList({ rows, dict }: LeaveListProps) {
  const errorMessages = actionErrorMessages(dict);

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState icon="leave">{dict.leave.empty}</EmptyState>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map(({ request, employee, actionable }) => {
        const isPending = request.status === "pending";

        return (
          <li key={request.id}>
            <Card
              padding="sm"
              className={cn(isPending && "border-warn/40 bg-surface-warn")}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-md font-semibold">
                      {employee ? employeeDisplayName(employee) : dict.common.dash}
                    </span>
                    <Badge tone={isPending ? "warning" : "neutral"}>
                      {dict.leave.types[request.type]}
                    </Badge>
                  </div>
                  <div className="tabular text-sm text-muted">
                    {formatDateRange(request.startDate, request.endDate, dict)}
                  </div>
                  {request.note ? (
                    <div className="mt-0.5 text-xs text-muted">{request.note}</div>
                  ) : null}
                </div>
                <StatusBadge
                  status={request.status}
                  label={dict.leave.status[request.status]}
                />
              </div>

              {actionable ? (
                <DecisionButtons
                  approveLabel={dict.common.approve}
                  rejectLabel={dict.common.reject}
                  errorMessages={errorMessages}
                  onDecide={decideLeaveAction.bind(null, request.id)}
                />
              ) : null}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
