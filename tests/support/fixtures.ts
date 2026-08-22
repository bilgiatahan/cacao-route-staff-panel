/**
 * Minimal rows for the swap tests, written straight through Prisma.
 *
 * Deliberately not `prisma/seed.ts`: these tests assert on exact counts, so
 * every row in the database should be one the test put there.
 */

import { prisma } from "@/server/db/client";

export const MONDAY = "2026-08-03";

/** Everything the swap flow can touch, cleared between tests. */
export async function resetDatabase(): Promise<void> {
  await prisma.notificationRead.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.swapRequest.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
}

export async function createEmployee(
  id: string,
  firstName: string,
  overrides: { role?: "admin" | "staff"; sortOrder?: number } = {},
): Promise<string> {
  await prisma.employee.create({
    data: {
      id,
      firstName,
      lastName: "Test",
      positionTr: "Barista",
      positionEn: "Barista",
      hourlyRate: 130,
      contract: "part",
      birthDate: null,
      hiredAt: null,
      leaveBalance: 14,
      phone: "",
      email: `${id}@example.test`,
      address: "",
      role: overrides.role ?? "staff",
      isTaskRow: false,
      sortOrder: overrides.sortOrder ?? 0,
      archivedAt: null,
    },
  });
  return id;
}

export async function createShift(
  employeeId: string,
  date: string,
  startMinutes = 9 * 60,
  endMinutes = 17 * 60,
): Promise<string> {
  const id = `shift-${employeeId}-${date}`;
  await prisma.shift.create({ data: { id, employeeId, date, startMinutes, endMinutes } });
  return id;
}

export async function createPendingSwap(
  id: string,
  requesterId: string,
  targetId: string,
  date: string,
): Promise<string> {
  await prisma.swapRequest.create({
    data: {
      id,
      requesterId,
      targetId,
      date,
      status: "pending",
      createdAt: new Date(),
      decidedAt: null,
    },
  });
  return id;
}

/** The shift row for one person on one day, or `null`. */
export async function shiftOwnerOn(date: string, employeeId: string) {
  return prisma.shift.findUnique({ where: { employeeId_date: { employeeId, date } } });
}

export async function swapStatusOf(id: string) {
  const row = await prisma.swapRequest.findUnique({ where: { id } });
  return row?.status ?? null;
}

export async function countNotifications(): Promise<number> {
  return prisma.notification.count();
}
