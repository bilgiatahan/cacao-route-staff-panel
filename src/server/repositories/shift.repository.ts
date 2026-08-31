import "server-only";

import { weekDates } from "@/lib/date";
import type { IsoDate, Shift } from "@/types/domain";
import type { Prisma } from "@/generated/prisma/client";

import { createId, prisma } from "../db/client";

export interface ShiftInput {
  employeeId: string;
  date: IsoDate;
  startMinutes: number;
  endMinutes: number;
}

export interface CopyWeekResult {
  /** Shifts written into the target week. */
  copied: number;
  /** Shifts the copy overwrote — what the week held before. */
  replaced: number;
}

export const shiftRepository = {
  async listByDateRange(start: IsoDate, end: IsoDate): Promise<Shift[]> {
    // `date` is a `YYYY-MM-DD` string, where lexicographic order is
    // chronological order — so a plain string range is a correct date range.
    return prisma.shift.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: [{ date: "asc" }, { startMinutes: "asc" }],
    });
  },

  async listByWeek(weekStart: IsoDate): Promise<Shift[]> {
    const dates = weekDates(weekStart);
    return this.listByDateRange(dates[0], dates[6]);
  },

  /**
   * One person's shifts over a date range.
   *
   * Same string-range trick as `listByDateRange`, narrowed by employee. The
   * employee detail screen reports a whole calendar month for one person, and
   * fetching the month for *everyone* to then discard all but one row is the
   * difference between a few dozen rows and a few thousand.
   */
  async listByEmployeeAndDateRange(
    employeeId: string,
    start: IsoDate,
    end: IsoDate,
  ): Promise<Shift[]> {
    return prisma.shift.findMany({
      where: { employeeId, date: { gte: start, lte: end } },
      orderBy: [{ date: "asc" }, { startMinutes: "asc" }],
    });
  },

  async listByEmployeeAndWeek(employeeId: string, weekStart: IsoDate): Promise<Shift[]> {
    const dates = weekDates(weekStart);
    return this.listByEmployeeAndDateRange(employeeId, dates[0], dates[6]);
  },

  async findByEmployeeAndDate(employeeId: string, date: IsoDate): Promise<Shift | null> {
    return prisma.shift.findUnique({ where: { employeeId_date: { employeeId, date } } });
  },

  /** One shift per employee per day — writing again replaces the existing one. */
  async upsert(input: ShiftInput): Promise<Shift> {
    const { employeeId, date, startMinutes, endMinutes } = input;

    return prisma.shift.upsert({
      where: { employeeId_date: { employeeId, date } },
      create: { id: createId("shift"), employeeId, date, startMinutes, endMinutes },
      update: { startMinutes, endMinutes },
    });
  },

  async remove(employeeId: string, date: IsoDate): Promise<boolean> {
    const { count } = await prisma.shift.deleteMany({ where: { employeeId, date } });
    return count > 0;
  },

  /**
   * Replaces one week's roster with a copy of another week's, in one transaction.
   *
   * The read, the delete and the insert have to land together. `[employeeId,
   * date]` is unique, so a copy that inserted before clearing the target week
   * would collide on every day the target already has a shift; and a delete that
   * committed while the insert failed would leave the week wiped rather than
   * copied. So the whole thing is one transaction, and a failure anywhere leaves
   * the week exactly as it was.
   *
   * An empty source week is a no-op rather than a wipe: "copy last week" over a
   * week nobody scheduled means there is nothing to copy, not that this week
   * should be cleared. The action refuses that case before it gets here; the
   * guard is repeated inside the transaction because the source can empty out
   * between the two.
   *
   * `employeeIds` is the roster — passed in rather than read here, because
   * "who is on the roster" is `isRosterMember`'s rule and repositories do not
   * import each other. Shifts belonging to anyone else (an archived person, an
   * admin) are neither copied nor deleted.
   */
  async copyWeek(
    sourceWeekStart: IsoDate,
    targetWeekStart: IsoDate,
    employeeIds: string[],
  ): Promise<CopyWeekResult> {
    if (employeeIds.length === 0) return { copied: 0, replaced: 0 };

    const source = weekDates(sourceWeekStart);
    const target = weekDates(targetWeekStart);
    // Both weeks are Monday-anchored runs of seven days, so position in the week
    // *is* the mapping — Monday to Monday, Sunday to Sunday — with no date
    // arithmetic that a DST boundary could shift by an hour.
    const targetDateFor = new Map(source.map((date, index) => [date, target[index]]));

    return prisma.$transaction(async (tx) => {
      const rows = await tx.shift.findMany({
        where: {
          employeeId: { in: employeeIds },
          date: { gte: source[0], lte: source[6] },
        },
      });
      if (rows.length === 0) return { copied: 0, replaced: 0 };

      const { count: replaced } = await tx.shift.deleteMany({
        where: {
          employeeId: { in: employeeIds },
          date: { gte: target[0], lte: target[6] },
        },
      });

      const data = rows.flatMap((row) => {
        const date = targetDateFor.get(row.date);
        // Unreachable given the range filter above; written as a filter rather
        // than a `!` so a widened range can never write an undefined date.
        if (!date) return [];
        return [
          {
            id: createId("shift"),
            employeeId: row.employeeId,
            date,
            startMinutes: row.startMinutes,
            endMinutes: row.endMinutes,
          },
        ];
      });

      await tx.shift.createMany({ data });

      return { copied: data.length, replaced };
    });
  },

  /**
   * Moves a day's shift from one employee to another (used by swaps).
   *
   * Takes the caller's transaction client rather than opening its own: approving
   * a swap has to flip the request's status and move the shift together, so the
   * transaction boundary belongs to the caller (`swapRepository.approve`). Both
   * statements still have to land together — the target may already have a shift
   * that day, and the `[employeeId, date]` unique index would reject the move if
   * the delete were skipped or lost.
   *
   * Returns `false` when the source employee holds no shift that day, which
   * leaves it to the caller to decide whether that aborts the transaction.
   */
  async reassign(
    tx: Prisma.TransactionClient,
    fromEmployeeId: string,
    toEmployeeId: string,
    date: IsoDate,
  ): Promise<boolean> {
    const source = await tx.shift.findUnique({
      where: { employeeId_date: { employeeId: fromEmployeeId, date } },
    });
    if (!source) return false;

    await tx.shift.deleteMany({ where: { employeeId: toEmployeeId, date } });
    await tx.shift.update({ where: { id: source.id }, data: { employeeId: toEmployeeId } });

    return true;
  },
};
