import { CLOSING_MINUTES, OPENING_MINUTES } from "@/lib/constants";
import { fromIsoDate } from "@/lib/date";
import { employeeDisplayName } from "@/lib/employee";
import type { ScheduleRow } from "@/lib/domain/schedule";
import {
  formatHours,
  formatNumericDate,
  formatShiftSpan,
  formatShiftSpanCompact,
  minutesToTime,
} from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import type { IsoDate } from "@/types/domain";

/**
 * The roster views are interactive, so the data crossing into the client is
 * pre-formatted here: the client bundle never needs the dictionary, the domain
 * model or the date helpers.
 */

/** The timeline spans one hour either side of trading hours. */
const TIMELINE_START = OPENING_MINUTES - 60;
const TIMELINE_END = CLOSING_MINUTES + 60;
const TIMELINE_SPAN = TIMELINE_END - TIMELINE_START;

const DEFAULT_START_TIME = "09:00";
const DEFAULT_END_TIME = "17:00";

export interface RosterCellView {
  date: IsoDate;
  state: "shift" | "leave" | "off";
  /** Top line in a grid cell: clock-in, the leave marker, or a dot. */
  primary: string;
  /** Second line: clock-out, when there is a shift. */
  secondary: string;
  /** Chip label in the person view. */
  compact: string;
  /**
   * The cell's state in words, for the accessible name. Colour and a dash are
   * not a representation a screen reader can use.
   */
  stateLabel: string;
  /** Pre-filled editor values. */
  startTime: string;
  endTime: string;
}

export interface RosterRowView {
  employeeId: string;
  name: string;
  hoursLabel: string;
  isTaskRow: boolean;
  cells: RosterCellView[];
}

export interface DayColumnView {
  date: IsoDate;
  index: number;
  shortLabel: string;
  dayOfMonth: string;
  /** "03/08/26" — the grid header, where the month is worth having. */
  dateLabel: string;
  isToday: boolean;
}

export interface DayRowView {
  employeeId: string;
  name: string;
  spanLabel: string;
  /** Percentages positioning the bar on the day timeline. */
  leftPercent: number;
  widthPercent: number;
  isTaskRow: boolean;
  startTime: string;
  endTime: string;
  date: IsoDate;
}

export interface DayOffView {
  employeeId: string;
  name: string;
  onLeave: boolean;
  date: IsoDate;
}

export function buildDayColumns(
  dates: IsoDate[],
  dict: Dictionary,
  today: IsoDate | null,
): DayColumnView[] {
  return dates.map((date, index) => ({
    date,
    index,
    shortLabel: dict.calendar.daysShort[index],
    dayOfMonth: String(fromIsoDate(date).getDate()),
    dateLabel: formatNumericDate(date),
    isToday: date === today,
  }));
}

export function buildRosterRows(rows: ScheduleRow[], dict: Dictionary): RosterRowView[] {
  return rows.map((row) => ({
    employeeId: row.employee.id,
    name: employeeDisplayName(row.employee) + (row.employee.isTaskRow ? " ·" : ""),
    hoursLabel: row.employee.isTaskRow ? dict.timetable.task : formatHours(row.hours, dict),
    isTaskRow: row.employee.isTaskRow,
    cells: row.cells.map<RosterCellView>((cell) => {
      if (cell.shift) {
        return {
          date: cell.date,
          state: "shift",
          primary: minutesToTime(cell.shift.startMinutes),
          secondary: minutesToTime(cell.shift.endMinutes),
          compact: formatShiftSpanCompact(cell.shift),
          stateLabel: formatShiftSpan(cell.shift, dict),
          startTime: minutesToTime(cell.shift.startMinutes),
          endTime: minutesToTime(cell.shift.endMinutes),
        };
      }

      const onLeave = cell.state === "leave";
      return {
        date: cell.date,
        state: onLeave ? "leave" : "off",
        // An en dash reads as "nothing here"; the middot read as a speck of dirt.
        primary: onLeave ? dict.timetable.leaveShort : "–",
        secondary: "",
        compact: onLeave ? dict.timetable.leaveInitial : "–",
        stateLabel: onLeave ? dict.timetable.onLeave : dict.timetable.legendOff,
        startTime: DEFAULT_START_TIME,
        endTime: DEFAULT_END_TIME,
      };
    }),
  }));
}

export interface RosterTotalsView {
  /** Row header, e.g. "Toplam". */
  label: string;
  /** The week's total across every counted row. */
  totalLabel: string;
  /** One entry per day column, in column order. */
  days: { date: IsoDate; label: string; ariaLabel: string; isEmpty: boolean }[];
}

/**
 * Column and week totals for the foot of the grid. Task rows are excluded, the
 * same way they are left out of headcount and payroll — a task carries no hours
 * anyone is paid for.
 */
export function buildRosterTotals(
  rows: ScheduleRow[],
  dates: IsoDate[],
  dict: Dictionary,
): RosterTotalsView {
  const counted = rows.filter((row) => !row.employee.isTaskRow);

  const days = dates.map((date) => {
    const minutes = counted.reduce((sum, row) => {
      const shift = row.cells.find((cell) => cell.date === date)?.shift;
      return shift ? sum + (shift.endMinutes - shift.startMinutes) : sum;
    }, 0);

    const hoursLabel = formatHours(minutes / 60, dict);
    return {
      date,
      // An empty column reads as an empty cell does; the figure stays in the
      // accessible name, so nothing is lost by not printing "0h" seven times.
      label: minutes === 0 ? "–" : hoursLabel,
      ariaLabel: `${dict.timetable.total} · ${date} · ${hoursLabel}`,
      isEmpty: minutes === 0,
    };
  });

  return {
    label: dict.timetable.total,
    totalLabel: formatHours(
      counted.reduce((sum, row) => sum + row.hours, 0),
      dict,
    ),
    days,
  };
}

export function buildDayRows(
  rows: ScheduleRow[],
  date: IsoDate,
  dict: Dictionary,
): { onShift: DayRowView[]; off: DayOffView[] } {
  const onShift: DayRowView[] = [];
  const off: DayOffView[] = [];

  for (const row of rows) {
    const cell = row.cells.find((item) => item.date === date);
    const name = employeeDisplayName(row.employee);

    if (cell?.shift) {
      const left = ((cell.shift.startMinutes - TIMELINE_START) / TIMELINE_SPAN) * 100;
      const width = ((cell.shift.endMinutes - cell.shift.startMinutes) / TIMELINE_SPAN) * 100;

      onShift.push({
        employeeId: row.employee.id,
        name,
        spanLabel: formatShiftSpan(cell.shift, dict),
        leftPercent: Math.max(0, Math.min(100, left)),
        widthPercent: Math.max(1, Math.min(100 - Math.max(0, left), width)),
        isTaskRow: row.employee.isTaskRow,
        startTime: minutesToTime(cell.shift.startMinutes),
        endTime: minutesToTime(cell.shift.endMinutes),
        date,
      });
      continue;
    }

    off.push({
      employeeId: row.employee.id,
      name: cell?.state === "leave" ? `${name} · ${dict.timetable.onLeave}` : name,
      onLeave: cell?.state === "leave",
      date,
    });
  }

  onShift.sort((a, b) => a.leftPercent - b.leftPercent);
  return { onShift, off };
}

/** Hour markers printed above the day timeline. */
export function buildHourTicks(): string[] {
  return [7, 10, 13, 16, 19].map((hour) => minutesToTime(hour * 60));
}
