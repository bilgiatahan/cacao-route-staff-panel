import { CLOSING_MINUTES, OPENING_GRACE_MINUTES, OPENING_MINUTES } from "@/lib/constants";
import type { IsoDate, Shift } from "@/types/domain";

export interface DayCoverage {
  date: IsoDate;
  /** Earliest clock-in of the day, or `null` when nobody is scheduled. */
  firstIn: number | null;
  /** Latest clock-out of the day. */
  lastOut: number | null;
  opensLate: boolean;
  closesEarly: boolean;
  hasGap: boolean;
}

/**
 * A day is "covered" when someone clocks in within the grace window after
 * opening and someone is still on until closing. Anything else is a gap the
 * manager needs to see.
 */
export function analyseDay(date: IsoDate, shifts: Shift[]): DayCoverage {
  const onDay = shifts.filter((shift) => shift.date === date);

  if (onDay.length === 0) {
    return {
      date,
      firstIn: null,
      lastOut: null,
      opensLate: true,
      closesEarly: true,
      hasGap: true,
    };
  }

  const firstIn = Math.min(...onDay.map((shift) => shift.startMinutes));
  const lastOut = Math.max(...onDay.map((shift) => shift.endMinutes));
  const opensLate = firstIn > OPENING_MINUTES + OPENING_GRACE_MINUTES;
  const closesEarly = lastOut < CLOSING_MINUTES;

  return { date, firstIn, lastOut, opensLate, closesEarly, hasGap: opensLate || closesEarly };
}

export function analyseWeek(dates: IsoDate[], shifts: Shift[]): DayCoverage[] {
  return dates.map((date) => analyseDay(date, shifts));
}

export function countGapDays(coverage: DayCoverage[]): number {
  return coverage.filter((day) => day.hasGap).length;
}
