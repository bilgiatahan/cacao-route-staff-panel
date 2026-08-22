import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { fromIsoDate, weekdayIndex } from "@/lib/date";
import { employeeDisplayName } from "@/lib/employee";
import { formatShiftSpan } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { actionErrorMessages } from "@/server/actions/action-result";
import { decideSwapAction } from "@/server/actions/swap.actions";
import type { SwapRow } from "@/server/services/leave.service";

import { DecisionButtons } from "./DecisionButtons";

export interface SwapListProps {
  rows: SwapRow[];
  dict: Dictionary;
}

/**
 * Shift swaps, in the same row shape as the leave list above it.
 *
 * No type badge here: every row in this section is a swap, so the section
 * heading names the category once instead of repeating a chip on each row. The
 * two names either side of the arrow are what distinguishes one row from
 * another.
 */
export function SwapList({ rows, dict }: SwapListProps) {
  const errorMessages = actionErrorMessages(dict);

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState icon="timetable">{dict.leave.swapsEmpty}</EmptyState>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map(({ request, requester, target, shift, actionable }) => {
        const date = fromIsoDate(request.date);
        const dayName = dict.calendar.daysLong[weekdayIndex(request.date)];
        const isPending = request.status === "pending";

        return (
          <li key={request.id}>
            <Card
              padding="sm"
              className={cn(isPending && "border-warn/40 bg-surface-warn")}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-md font-semibold">
                    {requester ? employeeDisplayName(requester) : dict.common.dash} ↔{" "}
                    {target ? employeeDisplayName(target) : dict.common.dash}
                  </div>
                  <div className="tabular text-sm text-muted">
                    {dayName} {date.getDate()} · {formatShiftSpan(shift, dict)}
                  </div>
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
                  onDecide={decideSwapAction.bind(null, request.id)}
                />
              ) : null}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
