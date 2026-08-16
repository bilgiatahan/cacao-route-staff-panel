import { EmptyState, RuledList } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { fromIsoDate, weekdayIndex } from "@/lib/date";
import { employeeDisplayName } from "@/lib/employee";
import { formatShiftSpan } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { decideSwapAction } from "@/server/actions/swap.actions";
import type { SwapRow } from "@/server/services/leave.service";
import type { Locale } from "@/types/domain";

import { DecisionButtons } from "./DecisionButtons";

export interface SwapListProps {
  rows: SwapRow[];
  dict: Dictionary;
  locale: Locale;
}

export function SwapList({ rows, dict, locale }: SwapListProps) {
  if (rows.length === 0) {
    return (
      <RuledList>
        <EmptyState>{dict.leave.swapsEmpty}</EmptyState>
      </RuledList>
    );
  }

  return (
    <RuledList>
      <ul>
        {rows.map(({ request, requester, target, shift, actionable }) => {
          const date = fromIsoDate(request.date);
          const dayName = dict.calendar.daysLong[weekdayIndex(request.date)];

          return (
            <li
              key={request.id}
              className={cn(
                "px-4 py-3",
                request.status === "pending" ? "bg-surface-warn" : "bg-surface",
              )}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="text-base font-bold">
                    {requester ? employeeDisplayName(requester, locale) : dict.common.dash} ↔{" "}
                    {target ? employeeDisplayName(target, locale) : dict.common.dash}
                  </div>
                  <div className="text-xs text-muted">
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
                  onDecide={decideSwapAction.bind(null, request.id)}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </RuledList>
  );
}
