import "server-only";

import { weekDates } from "@/lib/date";
import type { IsoDate, Shift } from "@/types/domain";

import { createId, prisma } from "../db/client";

export interface ShiftInput {
  employeeId: string;
  date: IsoDate;
  startMinutes: number;
  endMinutes: number;
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

  async listByEmployeeAndWeek(employeeId: string, weekStart: IsoDate): Promise<Shift[]> {
    const dates = weekDates(weekStart);
    return prisma.shift.findMany({
      where: { employeeId, date: { gte: dates[0], lte: dates[6] } },
      orderBy: { date: "asc" },
    });
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

  /** Moves a day's shift from one employee to another (used by swaps). */
  async reassign(fromEmployeeId: string, toEmployeeId: string, date: IsoDate): Promise<boolean> {
    const source = await prisma.shift.findUnique({
      where: { employeeId_date: { employeeId: fromEmployeeId, date } },
    });
    if (!source) return false;

    // Both statements have to land together: the target may already have a shift
    // that day, and the `[employeeId, date]` unique index would reject the move
    // if the delete were skipped or lost.
    await prisma.$transaction([
      prisma.shift.deleteMany({ where: { employeeId: toEmployeeId, date } }),
      prisma.shift.update({ where: { id: source.id }, data: { employeeId: toEmployeeId } }),
    ]);

    return true;
  },
};
