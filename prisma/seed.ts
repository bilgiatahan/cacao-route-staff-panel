/**
 * Seeds the demo roster into Postgres.
 *
 * This is the port of the old in-memory `createSeedDatabase()`. The generators
 * are reproduced verbatim — same blueprints, same deterministic shift variation,
 * same fixed ids — so the panel looks exactly as it did before the database
 * existed.
 *
 * Two things to know:
 *
 *  - Shifts are computed from the week the seed *runs* in and then persisted.
 *    The data no longer follows the calendar forward, so re-run `npm run db:reset`
 *    when the demo week has drifted too far into the past.
 *  - It is idempotent: every table is cleared first, so running it twice leaves
 *    the same rows rather than duplicates.
 *
 * Note that it deliberately does not import `src/server/db/seed.ts`-style
 * modules marked `server-only` — those throw outside the Next.js server runtime.
 * `seed-data.ts` and `src/lib/date.ts` are plain modules and are reused directly.
 */
import "dotenv/config";

import { hashSync } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { addIsoDays, currentWeekStartIso, weekDates } from "@/lib/date";
import { DEMO_PASSWORD, EMPLOYEE_BLUEPRINTS } from "@/server/db/seed-data";

/** Weeks generated either side of the current one, so week navigation has data. */
const SEEDED_WEEK_OFFSETS = [-2, -1, 0, 1, 2];

/**
 * Deterministic variation so neighbouring weeks are not carbon copies of the
 * current one — no RNG, so the seed is reproducible.
 */
function skipsShift(employeeIndex: number, dayIndex: number, weekOffset: number): boolean {
  if (weekOffset === 0) return false;
  return (employeeIndex + dayIndex + weekOffset * 3) % 7 === 0;
}

function buildEmployees() {
  return EMPLOYEE_BLUEPRINTS.map((blueprint, index) => ({
    id: blueprint.id,
    firstName: blueprint.firstName,
    lastName: blueprint.lastName,
    displayNameTr: blueprint.displayNameEn ? blueprint.firstName : null,
    displayNameEn: blueprint.displayNameEn ?? null,
    positionTr: blueprint.positionTr,
    positionEn: blueprint.positionEn,
    hourlyRate: blueprint.hourlyRate,
    contract: blueprint.contract,
    birthDate: blueprint.birthDate,
    hiredAt: blueprint.hiredAt,
    leaveBalance: blueprint.leaveBalance,
    phone: blueprint.phone,
    email: blueprint.email,
    address: blueprint.address,
    role: blueprint.role,
    isTaskRow: blueprint.isTaskRow ?? false,
    // Roster order was array position in the in-memory store; task rows sit last
    // in the blueprint list, so the index preserves that ordering exactly.
    sortOrder: index,
    archivedAt: null,
  }));
}

function buildShifts(currentWeekStart: string) {
  const shifts: Array<{
    id: string;
    employeeId: string;
    date: string;
    startMinutes: number;
    endMinutes: number;
  }> = [];

  EMPLOYEE_BLUEPRINTS.forEach((blueprint, employeeIndex) => {
    SEEDED_WEEK_OFFSETS.forEach((weekOffset) => {
      const weekStart = addIsoDays(currentWeekStart, weekOffset * 7);
      const dates = weekDates(weekStart);

      blueprint.template.forEach((template, dayIndex) => {
        if (!template) return;
        if (skipsShift(employeeIndex, dayIndex, weekOffset)) return;

        const [startHour, endHour] = template;
        shifts.push({
          id: `shift-${blueprint.id}-${dates[dayIndex]}`,
          employeeId: blueprint.id,
          date: dates[dayIndex],
          startMinutes: startHour * 60,
          endMinutes: endHour * 60,
        });
      });
    });
  });

  return shifts;
}

function buildLeaveRequests(currentWeekStart: string, now: Date) {
  const at = (days: number) => addIsoDays(currentWeekStart, days);
  const stamp = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000);

  const rows = [
    {
      employeeId: "emp-6",
      type: "annual" as const,
      startDate: at(2),
      endDate: at(3),
      note: "Aile ziyareti · Family visit",
      status: "approved" as const,
      createdAt: stamp(6),
      decidedAt: stamp(5),
      decidedByEmployeeId: "emp-2",
    },
    {
      employeeId: "emp-3",
      type: "sick" as const,
      startDate: at(8),
      endDate: at(8),
      note: "Doktor raporu · Doctor's note",
      status: "pending" as const,
      createdAt: stamp(1),
      decidedAt: null,
      decidedByEmployeeId: null,
    },
    {
      employeeId: "emp-5",
      type: "annual" as const,
      startDate: at(14),
      endDate: at(18),
      note: "Yaz tatili · Summer holiday",
      status: "pending" as const,
      createdAt: stamp(2),
      decidedAt: null,
      decidedByEmployeeId: null,
    },
    {
      employeeId: "emp-7",
      type: "annual" as const,
      startDate: at(-7),
      endDate: at(-6),
      note: "",
      status: "approved" as const,
      createdAt: stamp(12),
      decidedAt: stamp(11),
      decidedByEmployeeId: "emp-2",
    },
    {
      employeeId: "emp-9",
      type: "excuse" as const,
      startDate: at(-14),
      endDate: at(-14),
      note: "Taşınma · Moving day",
      status: "rejected" as const,
      createdAt: stamp(18),
      decidedAt: stamp(17),
      decidedByEmployeeId: "emp-2",
    },
    {
      employeeId: "emp-4",
      type: "annual" as const,
      startDate: at(21),
      endDate: at(23),
      note: "Düğün · Wedding",
      status: "pending" as const,
      createdAt: stamp(3),
      decidedAt: null,
      decidedByEmployeeId: null,
    },
    {
      employeeId: "emp-4",
      type: "excuse" as const,
      startDate: at(-21),
      endDate: at(-21),
      note: "",
      status: "approved" as const,
      createdAt: stamp(24),
      decidedAt: stamp(23),
      decidedByEmployeeId: "emp-2",
    },
  ];

  return rows.map((row, index) => ({ id: `leave-${index + 1}`, ...row }));
}

function buildSwapRequests(currentWeekStart: string, now: Date) {
  const at = (days: number) => addIsoDays(currentWeekStart, days);
  const stamp = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000);

  return [
    {
      id: "swap-1",
      requesterId: "emp-8",
      targetId: "emp-1",
      date: at(4),
      status: "pending" as const,
      createdAt: stamp(1),
      decidedAt: null,
    },
    {
      id: "swap-2",
      requesterId: "emp-7",
      targetId: "emp-5",
      date: at(5),
      status: "approved" as const,
      createdAt: stamp(4),
      decidedAt: stamp(3),
    },
  ];
}

/** Seeded read receipts, keyed by notification id — everything else is unread. */
const NOTIFICATION_READS: Record<string, string[]> = {
  "note-4": ["emp-2"],
  "note-5": ["emp-2", "emp-4"],
};

function buildNotifications(now: Date) {
  const stamp = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3_600_000);

  return [
    {
      id: "note-1",
      titleTr: "Annabel izin talebi gönderdi",
      titleEn: "Annabel submitted a leave request",
      bodyTr: "Çarşamba–Perşembe · Yıllık",
      bodyEn: "Wed–Thu · Annual",
      createdAt: stamp(2),
      audienceKind: "admins" as const,
      audienceEmployeeId: null,
    },
    {
      id: "note-2",
      titleTr: "Pazar günü kapsama boşluğu var",
      titleEn: "Sunday has a coverage gap",
      bodyTr: "Açılış 09:00, kapanış 18:00",
      bodyEn: "Opens 09:00, closes 18:00",
      createdAt: stamp(5),
      audienceKind: "admins" as const,
      audienceEmployeeId: null,
    },
    {
      id: "note-3",
      titleTr: "Bushra vardiya değişimi istedi",
      titleEn: "Bushra requested a swap",
      bodyTr: "Cuma · Ahmed",
      bodyEn: "Fri · Ahmed",
      createdAt: stamp(26),
      audienceKind: "all" as const,
      audienceEmployeeId: null,
    },
    {
      id: "note-4",
      titleTr: "Haftalık bordro hazır",
      titleEn: "Weekly payroll is ready",
      bodyTr: "Bu haftanın dönemi",
      bodyEn: "Current period",
      createdAt: stamp(30),
      audienceKind: "admins" as const,
      audienceEmployeeId: null,
    },
    {
      id: "note-5",
      titleTr: "Ahmed 50 saate ulaştı",
      titleEn: "Ahmed reached 50 hours",
      bodyTr: "Fazla mesai eşiği aşıldı",
      bodyEn: "Overtime threshold passed",
      createdAt: stamp(52),
      audienceKind: "all" as const,
      audienceEmployeeId: null,
    },
  ];
}

function buildUsers(employees: ReturnType<typeof buildEmployees>) {
  // Every demo account shares one password, so the (slow by design) hash runs once.
  const passwordHash = hashSync(DEMO_PASSWORD, 10);

  return employees
    .filter((employee) => !employee.isTaskRow && employee.email)
    .map((employee, index) => ({
      id: `user-${index + 1}`,
      email: employee.email.toLowerCase(),
      passwordHash,
      employeeId: employee.id,
    }));
}

async function main() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DIRECT_URL / DATABASE_URL is not set — see .env.example.");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  const now = new Date();
  const currentWeekStart = currentWeekStartIso();
  const employees = buildEmployees();
  const notifications = buildNotifications(now);

  try {
    // Reverse dependency order, so foreign keys never block the reset.
    await prisma.notificationRead.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.swapRequest.deleteMany();
    await prisma.leaveRequest.deleteMany();
    await prisma.shift.deleteMany();
    await prisma.user.deleteMany();
    await prisma.employee.deleteMany();

    await prisma.employee.createMany({ data: employees });
    await prisma.user.createMany({ data: buildUsers(employees) });
    await prisma.shift.createMany({ data: buildShifts(currentWeekStart) });
    await prisma.leaveRequest.createMany({ data: buildLeaveRequests(currentWeekStart, now) });
    await prisma.swapRequest.createMany({ data: buildSwapRequests(currentWeekStart, now) });

    await prisma.notification.createMany({ data: notifications });
    await prisma.notificationRead.createMany({
      data: notifications.flatMap((notification) =>
        (NOTIFICATION_READS[notification.id] ?? []).map((employeeId) => ({
          notificationId: notification.id,
          employeeId,
        })),
      ),
    });

    const [employeeCount, shiftCount] = await Promise.all([
      prisma.employee.count(),
      prisma.shift.count(),
    ]);

    console.log(
      `Seeded ${employeeCount} employees and ${shiftCount} shifts, anchored to the week of ${currentWeekStart}.`,
    );
    console.log(`Demo accounts share the password "${DEMO_PASSWORD}".`);
  } finally {
    await prisma.$disconnect();
  }
}

// Called rather than top-level-awaited: the package is CommonJS, so tsx compiles
// this file to CJS where top-level `await` is a syntax error.
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
