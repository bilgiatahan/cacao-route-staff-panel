import { EmptyState, RuledList } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { employeeDisplayName } from "@/lib/employee";
import { formatDateRange } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { decideLeaveAction } from "@/server/actions/leave.actions";
import type { LeaveRow } from "@/server/services/leave.service";
import type { Locale } from "@/types/domain";

import { DecisionButtons } from "./DecisionButtons";

export interface LeaveListProps {
  rows: LeaveRow[];
  dict: Dictionary;
  locale: Locale;
}

export function LeaveList({ rows, dict, locale }: LeaveListProps) {
  if (rows.length === 0) {
    return (
      <RuledList>
        <EmptyState>{dict.leave.empty}</EmptyState>
      </RuledList>
    );
  }

  return (
    <RuledList>
      <ul>
        {rows.map(({ request, employee, actionable }) => (
          <li
            key={request.id}
            className={cn(
              "px-4 py-3",
              request.status === "pending" ? "bg-surface-warn" : "bg-surface",
            )}
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <div className="text-md font-bold">
                  {employee ? employeeDisplayName(employee, locale) : dict.common.dash} ·{" "}
                  {dict.leave.types[request.type]}
                </div>
                <div className="text-sm text-[#605d5d]">
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
                onDecide={decideLeaveAction.bind(null, request.id)}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </RuledList>
  );
}
