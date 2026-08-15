import { RuledList } from "@/components/ui/Section";
import { fromIsoDate } from "@/lib/date";
import { formatHours, formatShiftSpan } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ScheduleCell } from "@/lib/domain/schedule";
import type { IsoDate } from "@/types/domain";

export interface WeekShiftListProps {
  cells: ScheduleCell[];
  dict: Dictionary;
  /** Marks the current day when the visible week contains it. */
  today: IsoDate | null;
  /**
   * Drops the ink rule and hands the rows to whatever encloses them — the
   * summary drops this list inside a card, the employee page keeps the rule.
   */
  bare?: boolean;
}

/** One row per weekday — the staff view of their own week. */
export function WeekShiftList({ cells, dict, today, bare = false }: WeekShiftListProps) {
  const Frame = bare ? "div" : RuledList;

  return (
    <Frame>
      <ul className={cn(bare && "divide-y divide-line")}>
        {cells.map((cell) => {
          const date = fromIsoDate(cell.date);
          const dayIndex = (date.getDay() + 6) % 7;
          const hours = cell.shift
            ? (cell.shift.endMinutes - cell.shift.startMinutes) / 60
            : null;

          return (
            <li
              key={cell.date}
              className={cn(
                "flex items-center gap-3 py-2.5",
                bare ? "px-3" : "px-4",
                cell.date === today ? "bg-surface-tint" : "bg-surface",
              )}
            >
              <span className="w-16 flex-none text-xs font-bold tracking-[0.06em] text-muted">
                {dict.calendar.daysShort[dayIndex]} {date.getDate()}
              </span>
              <span
                className={cn(
                  "tabular flex-1 text-base font-semibold",
                  cell.shift ? "text-ink" : "text-muted-soft",
                )}
              >
                {cell.state === "leave"
                  ? dict.timetable.onLeave
                  : formatShiftSpan(cell.shift, dict)}
              </span>
              <span className="tabular text-sm text-muted">
                {hours === null ? "" : formatHours(hours, dict)}
              </span>
            </li>
          );
        })}
      </ul>
    </Frame>
  );
}
