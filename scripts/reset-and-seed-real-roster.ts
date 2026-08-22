/**
 * One-time destructive reset + import of the real historical roster.
 *
 * `prisma/seed.ts` generates a *demo* roster anchored to the week it runs in.
 * This script does something different and does it once: it wipes every runtime
 * row and replaces them with the transcribed roster in
 * `data/historical-roster.json` — nine real staff members, seven real weeks,
 * 221 real shifts — plus one administrator that is deliberately *not* on the
 * roster.
 *
 * Three phases, in this order, and the order is the whole point:
 *
 *   1. Validate. Reads the JSON and the environment, touches no connection.
 *      Every check that can fail, fails here — before anything is deleted.
 *   2. Reset. Guarded by an exact opt-in variable. Reports the target database
 *      and what is about to be removed.
 *   3. Seed + verify. The deletes and the inserts go out as one batched
 *      `$transaction`, so a failure anywhere leaves the existing data intact
 *      rather than an empty panel. Then the database is queried back and the
 *      import is asserted against the source file.
 *
 * Run it from the repository root:
 *
 *   ALLOW_DATABASE_RESET=YES_I_KNOW_THIS_DELETES_ALL_DATA \
 *   SEED_ADMIN_NAME="Olivia Bennett" \
 *   SEED_ADMIN_EMAIL="admin@seed.cacaoroute.co.uk" \
 *   SEED_ADMIN_PASSWORD="…" \
 *   npm run db:seed:real
 *
 * Like `prisma/seed.ts` this runs under `tsx`, outside the Next.js runtime, so
 * it must not import anything marked `server-only`. `@/lib/date`,
 * `@/lib/format` and `@/lib/domain/payroll` are plain modules and are reused
 * directly — no second copy of the weekday or minutes-from-midnight logic.
 */
import "dotenv/config";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { hashSync } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { isValidIsoDate, startOfWeekIso, weekDates } from "@/lib/date";
import { minutesToTime, timeToMinutes } from "@/lib/format";
import { shiftHours } from "@/lib/domain/payroll";
import type { ContractType, IsoDate, Shift, UserRole } from "@/types/domain";

/** Exact opt-in required before a single row is deleted. */
const RESET_GUARD_ENV = "ALLOW_DATABASE_RESET";
const RESET_GUARD_VALUE = "YES_I_KNOW_THIS_DELETES_ALL_DATA";

/** Default location of the transcribed roster, relative to the repo root. */
const ROSTER_PATH = process.env.SEED_ROSTER_PATH ?? "data/historical-roster.json";

/** Shape assertions on the source file. A transcription that drifted is a bug. */
const EXPECTED_WEEK_COUNT = 7;
const EXPECTED_SHIFT_COUNT = 221;

/** bcrypt cost, matching `prisma/seed.ts` and the login path in `src/server/auth`. */
const BCRYPT_ROUNDS = 10;

/* ------------------------------------------------------------------ roster */

/** Roster labels as they appear in the JSON, in roster order. */
const ROSTER_LABELS = [
  "AHMED",
  "ANIMA",
  "ANGILA",
  "ELLA",
  "VERONICA",
  "ANNABEL",
  "ERIN",
  "BUSHRA",
  "RUMESH",
] as const;

type RosterLabel = (typeof ROSTER_LABELS)[number];

interface RosterShift {
  employee: RosterLabel;
  date: IsoDate;
  start: string;
  end: string;
}

interface RosterWeek {
  weekStart: IsoDate;
  expectedWeeklyHours: Record<string, number>;
  shifts: RosterShift[];
}

interface RosterFile {
  employees: string[];
  weeks: RosterWeek[];
}

/**
 * Placeholder personal details.
 *
 * The roster carries names, dates and times and nothing else, but `Employee`
 * needs a full record. Everything below is deliberately fake, deliberately
 * English/London, and deliberately deterministic — re-running the script
 * produces byte-identical rows. Nothing here is real personal information.
 */
interface StaffBlueprint {
  label: RosterLabel;
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  contract: ContractType;
  /**
   * Pounds per hour, as a decimal — £10.25 is `10.25`, not `1025`. Stored in
   * `Decimal(10, 2)` like every other rate. Deliberately flat placeholders in
   * the £10.00–£10.50 band, matching `src/server/db/seed-data.ts` person for
   * person so the two seeds cannot disagree about what anyone earns.
   */
  hourlyRate: number;
  phone: string;
  email: string;
  address: string;
  birthDate: IsoDate;
  hiredAt: IsoDate;
}

/** Annual leave allowance given to every seeded record, in days. */
const SEED_LEAVE_BALANCE = 10;

const STAFF_BLUEPRINTS: StaffBlueprint[] = [
  {
    label: "AHMED",
    id: "emp-ahmed",
    firstName: "Ahmed",
    lastName: "Hassan",
    position: "Barista",
    contract: "full",
    hourlyRate: 10,
    phone: "+44 7700 900101",
    email: "ahmed@seed.cacaoroute.co.uk",
    address: "12 Camden High Street, London, NW1 0JH",
    birthDate: "1996-03-14",
    hiredAt: "2025-01-06",
  },
  {
    label: "ANIMA",
    id: "emp-anima",
    firstName: "Anima",
    lastName: "Shrestha",
    position: "Shift Lead",
    contract: "full",
    hourlyRate: 10.5,
    phone: "+44 7700 900102",
    email: "anima@seed.cacaoroute.co.uk",
    address: "48 Green Lanes, London, N16 9EJ",
    birthDate: "1993-09-30",
    hiredAt: "2024-11-04",
  },
  {
    label: "ANGILA",
    id: "emp-angila",
    firstName: "Angila",
    lastName: "Rai",
    position: "Barista",
    contract: "part",
    hourlyRate: 10,
    phone: "+44 7700 900103",
    email: "angila@seed.cacaoroute.co.uk",
    address: "7 Mare Street, London, E8 4RP",
    birthDate: "1999-06-22",
    hiredAt: "2025-03-03",
  },
  {
    label: "ELLA",
    id: "emp-ella",
    firstName: "Ella",
    lastName: "Whitfield",
    position: "Cashier",
    contract: "part",
    hourlyRate: 10,
    phone: "+44 7700 900104",
    email: "ella@seed.cacaoroute.co.uk",
    address: "21 Brixton Road, London, SW9 6BU",
    birthDate: "2001-01-18",
    hiredAt: "2025-05-12",
  },
  {
    label: "VERONICA",
    id: "emp-veronica",
    firstName: "Veronica",
    lastName: "Adeyemi",
    position: "Barista",
    contract: "part",
    hourlyRate: 10.25,
    phone: "+44 7700 900105",
    email: "veronica@seed.cacaoroute.co.uk",
    address: "65 Holloway Road, London, N7 8JL",
    birthDate: "1997-11-09",
    hiredAt: "2025-06-02",
  },
  {
    label: "ANNABEL",
    id: "emp-annabel",
    firstName: "Annabel",
    lastName: "Fletcher",
    position: "Staff Member",
    contract: "part",
    hourlyRate: 10,
    phone: "+44 7700 900106",
    email: "annabel@seed.cacaoroute.co.uk",
    address: "9 Bethnal Green Road, London, E1 6LA",
    birthDate: "2003-04-27",
    hiredAt: "2026-02-09",
  },
  {
    label: "ERIN",
    id: "emp-erin",
    firstName: "Erin",
    lastName: "Doherty",
    position: "Staff Member",
    contract: "part",
    hourlyRate: 10,
    phone: "+44 7700 900107",
    email: "erin@seed.cacaoroute.co.uk",
    address: "33 Kingsland High Street, London, E8 2JS",
    birthDate: "2002-08-05",
    hiredAt: "2026-03-16",
  },
  {
    label: "BUSHRA",
    id: "emp-bushra",
    firstName: "Bushra",
    lastName: "Iqbal",
    position: "Barista",
    contract: "part",
    hourlyRate: 10.5,
    phone: "+44 7700 900108",
    email: "bushra@seed.cacaoroute.co.uk",
    address: "14 Peckham Rye, London, SE15 4JR",
    birthDate: "1998-12-01",
    hiredAt: "2025-09-01",
  },
  {
    label: "RUMESH",
    id: "emp-rumesh",
    firstName: "Rumesh",
    lastName: "Perera",
    position: "Kitchen Porter",
    contract: "part",
    hourlyRate: 10.25,
    phone: "+44 7700 900109",
    email: "rumesh@seed.cacaoroute.co.uk",
    address: "52 Whitechapel Road, London, E1 1JX",
    birthDate: "1995-07-19",
    hiredAt: "2025-10-13",
  },
];

/** Fixed details for the administrator; only name, email and password are env-driven. */
const ADMIN_DEFAULTS = {
  employeeId: "emp-admin",
  userId: "user-admin",
  position: "Manager",
  contract: "full" as ContractType,
  hourlyRate: 10.5,
  phone: "+44 7700 900100",
  address: "1 Shoreditch High Street, London, E1 6PG",
  birthDate: "1988-05-21",
  hiredAt: "2024-09-02",
};

/* ------------------------------------------------------------------- output */

function heading(text: string): void {
  console.log(`\n${text}\n${"─".repeat(text.length)}`);
}

/** Aborts with a readable message rather than a stack trace. */
class AbortError extends Error {}

function abort(message: string): never {
  throw new AbortError(message);
}

/* ------------------------------------------- phase 1 · validation, no writes */

interface AdminConfig {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
}

/**
 * Reads the admin credentials from the environment. Done in phase 1 so a missing
 * variable aborts before the reset, not between the delete and the insert.
 * The password is hashed here and the plaintext is never logged.
 */
function readAdminConfig(): AdminConfig {
  const name = (process.env.SEED_ADMIN_NAME ?? "").trim();
  const email = (process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";

  const missing = [
    name ? null : "SEED_ADMIN_NAME",
    email ? null : "SEED_ADMIN_EMAIL",
    password ? null : "SEED_ADMIN_PASSWORD",
  ].filter((value): value is string => value !== null);

  if (missing.length > 0) {
    abort(`Missing required environment variable(s): ${missing.join(", ")}.`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    abort("SEED_ADMIN_EMAIL is not a valid email address.");
  }
  if (STAFF_BLUEPRINTS.some((staff) => staff.email === email)) {
    abort("SEED_ADMIN_EMAIL collides with a seeded staff email — pick another address.");
  }
  if (password.length < 8) {
    abort("SEED_ADMIN_PASSWORD must be at least 8 characters.");
  }

  // The roster holds single names, but `Employee` splits first and last. Everything
  // after the first space is the surname; a single-word name gets an empty surname,
  // which `fullName()` already handles.
  const [firstName, ...rest] = name.split(/\s+/);

  return {
    firstName,
    lastName: rest.join(" "),
    email,
    // Same convention as `prisma/seed.ts` and the `compare()` in `src/server/auth`.
    passwordHash: hashSync(password, BCRYPT_ROUNDS),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parses and fully validates the roster file. Returns the typed roster only when
 * every check passes; otherwise prints all failures at once and aborts, so a
 * bad transcription is fixed in one pass rather than one error per run.
 */
function validateRoster(path: string): { roster: RosterFile; shiftCount: number } {
  heading("Phase 1 · Validation (no writes)");
  console.log(`  Source: ${path}`);

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    abort(`Could not read or parse ${path}: ${(error as Error).message}`);
  }

  const errors: string[] = [];
  const fail = (message: string) => errors.push(message);

  if (!isRecord(raw)) abort(`${path} is not a JSON object.`);
  if (!Array.isArray(raw.employees)) abort(`${path}: "employees" must be an array.`);
  if (!Array.isArray(raw.weeks)) abort(`${path}: "weeks" must be an array.`);

  const knownLabels = new Set<string>(ROSTER_LABELS);

  // The file's own roster list must be exactly the nine people we seed.
  const declared = raw.employees.filter((value): value is string => typeof value === "string");
  if (declared.length !== raw.employees.length) fail(`"employees" contains a non-string entry.`);
  for (const label of declared) {
    if (!knownLabels.has(label)) fail(`"employees" holds unknown label "${label}".`);
  }
  for (const label of ROSTER_LABELS) {
    if (!declared.includes(label)) fail(`"employees" is missing "${label}".`);
  }

  if (raw.weeks.length !== EXPECTED_WEEK_COUNT) {
    fail(`Expected ${EXPECTED_WEEK_COUNT} weeks, found ${raw.weeks.length}.`);
  }

  const weeks: RosterWeek[] = [];
  // Keyed employee|date across the whole file: `Shift` has @@unique([employeeId, date]),
  // so one shift per person per day is a hard domain rule, not a preference.
  const seenShiftKeys = new Set<string>();
  let totalShifts = 0;

  raw.weeks.forEach((weekValue, weekIndex) => {
    const where = `weeks[${weekIndex}]`;
    if (!isRecord(weekValue)) {
      fail(`${where} is not an object.`);
      return;
    }

    const weekStart = weekValue.weekStart;
    if (typeof weekStart !== "string" || !isValidIsoDate(weekStart)) {
      fail(`${where}.weekStart "${String(weekStart)}" is not a valid YYYY-MM-DD date.`);
      return;
    }
    if (startOfWeekIso(weekStart) !== weekStart) {
      fail(`${where}.weekStart ${weekStart} is not a Monday.`);
    }

    const validDates = new Set(weekDates(weekStart));
    const expectedHours = weekValue.expectedWeeklyHours;
    if (!isRecord(expectedHours)) {
      fail(`${where}.expectedWeeklyHours is missing or not an object.`);
      return;
    }
    if (!Array.isArray(weekValue.shifts)) {
      fail(`${where}.shifts is missing or not an array.`);
      return;
    }

    // Every declared expectation must name someone on the roster, and every
    // roster member must be accounted for — silence is not zero.
    for (const label of Object.keys(expectedHours)) {
      if (!knownLabels.has(label)) {
        fail(`${where}.expectedWeeklyHours names unknown employee "${label}".`);
      }
      if (typeof expectedHours[label] !== "number" || !Number.isFinite(expectedHours[label])) {
        fail(`${where}.expectedWeeklyHours.${label} is not a finite number.`);
      }
    }
    for (const label of ROSTER_LABELS) {
      if (!(label in expectedHours)) {
        fail(`${where}.expectedWeeklyHours has no entry for ${label}.`);
      }
    }

    // Sum in minutes, not hours: integer arithmetic, so "exactly" means exactly.
    const minutesByLabel = new Map<string, number>();
    const shifts: RosterShift[] = [];

    weekValue.shifts.forEach((shiftValue, shiftIndex) => {
      const at = `${where}.shifts[${shiftIndex}]`;
      if (!isRecord(shiftValue)) {
        fail(`${at} is not an object.`);
        return;
      }

      const { employee, date, start, end } = shiftValue;
      if (typeof employee !== "string" || !knownLabels.has(employee)) {
        fail(`${at}.employee "${String(employee)}" is not one of the nine roster members.`);
        return;
      }
      if (typeof date !== "string" || !isValidIsoDate(date)) {
        fail(`${at}.date "${String(date)}" is not a valid YYYY-MM-DD date.`);
        return;
      }
      if (!validDates.has(date)) {
        fail(`${at}.date ${date} falls outside the week beginning ${weekStart}.`);
        return;
      }

      if (typeof start !== "string" || timeToMinutes(start) === null) {
        fail(`${at}.start "${String(start)}" is not a valid HH:MM time.`);
        return;
      }
      if (typeof end !== "string" || timeToMinutes(end) === null) {
        fail(`${at}.end "${String(end)}" is not a valid HH:MM time.`);
        return;
      }
      const startMinutes = timeToMinutes(start) as number;
      const endMinutes = timeToMinutes(end) as number;
      if (endMinutes <= startMinutes) {
        fail(`${at} ends at ${end} which is not after its ${start} start.`);
        return;
      }

      const key = `${employee}|${date}`;
      if (seenShiftKeys.has(key)) {
        fail(`${at} duplicates ${employee} on ${date} — one shift per person per day.`);
        return;
      }
      seenShiftKeys.add(key);

      minutesByLabel.set(employee, (minutesByLabel.get(employee) ?? 0) + (endMinutes - startMinutes));
      shifts.push({ employee: employee as RosterLabel, date, start, end });
      totalShifts += 1;
    });

    for (const label of ROSTER_LABELS) {
      const expected = expectedHours[label];
      if (typeof expected !== "number") continue;
      const actual = (minutesByLabel.get(label) ?? 0) / 60;
      if (actual !== expected) {
        fail(`${where} ${label}: shifts total ${actual}h but expectedWeeklyHours says ${expected}h.`);
      }
    }

    weeks.push({
      weekStart,
      expectedWeeklyHours: expectedHours as Record<string, number>,
      shifts,
    });
  });

  if (totalShifts !== EXPECTED_SHIFT_COUNT) {
    fail(`Expected ${EXPECTED_SHIFT_COUNT} shifts, found ${totalShifts}.`);
  }

  console.log(`  Roster members: ${declared.length}`);
  console.log(`  Weeks: ${raw.weeks.length}`);
  console.log(`  Shifts: ${totalShifts}`);
  for (const week of weeks) {
    const minutes = week.shifts.reduce(
      (total, shift) => total + ((timeToMinutes(shift.end) ?? 0) - (timeToMinutes(shift.start) ?? 0)),
      0,
    );
    console.log(
      `    ${week.weekStart}  ${String(week.shifts.length).padStart(3)} shifts  ${minutes / 60}h`,
    );
  }

  if (errors.length > 0) {
    console.error(`\n  ${errors.length} validation error(s):`);
    for (const message of errors) console.error(`    ✗ ${message}`);
    abort("Roster validation failed. Nothing was deleted and nothing was inserted.");
  }

  console.log("  ✓ Structure, dates, times, duplicates and weekly totals all valid.");
  return { roster: { employees: declared, weeks }, shiftCount: totalShifts };
}

/* ------------------------------------------------ phase 2 · destructive reset */

/** Connection details worth printing. Credentials are never part of the output. */
function describeTarget(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const database = url.pathname.replace(/^\//, "") || "(default)";
    const port = url.port || "5432";
    return `${url.hostname}:${port}/${database}${url.username ? ` as ${url.username}` : ""}`;
  } catch {
    return "(unparseable connection string)";
  }
}

const RUNTIME_TABLES = [
  "notification_reads",
  "notifications",
  "swap_requests",
  "leave_requests",
  "shifts",
  "users",
  "employees",
] as const;

type Client = InstanceType<typeof PrismaClient>;

async function countRuntimeRows(prisma: Client): Promise<Record<string, number>> {
  const [notificationReads, notifications, swapRequests, leaveRequests, shifts, users, employees] =
    await Promise.all([
      prisma.notificationRead.count(),
      prisma.notification.count(),
      prisma.swapRequest.count(),
      prisma.leaveRequest.count(),
      prisma.shift.count(),
      prisma.user.count(),
      prisma.employee.count(),
    ]);

  return {
    notification_reads: notificationReads,
    notifications,
    swap_requests: swapRequests,
    leave_requests: leaveRequests,
    shifts,
    users,
    employees,
  };
}

/* ---------------------------------------------------------- phase 3 · seeding */

function buildEmployeeRows(admin: AdminConfig) {
  const staff = STAFF_BLUEPRINTS.map((blueprint, index) => ({
    id: blueprint.id,
    firstName: blueprint.firstName,
    lastName: blueprint.lastName,
    // Only task rows carry a translated display label, and none of these are.
    displayNameTr: null,
    displayNameEn: null,
    // Placeholder titles are English in both columns: the schema needs two
    // values, the deployment is London, and translating fake data adds nothing.
    positionTr: blueprint.position,
    positionEn: blueprint.position,
    hourlyRate: blueprint.hourlyRate,
    contract: blueprint.contract,
    birthDate: blueprint.birthDate,
    hiredAt: blueprint.hiredAt,
    leaveBalance: SEED_LEAVE_BALANCE,
    phone: blueprint.phone,
    email: blueprint.email,
    address: blueprint.address,
    role: "staff" as UserRole,
    isTaskRow: false,
    // Roster order is the order of the transcribed file; the administrator is
    // appended so the nine roster rows keep their original positions.
    sortOrder: index,
    archivedAt: null,
  }));

  const adminRow = {
    id: ADMIN_DEFAULTS.employeeId,
    firstName: admin.firstName,
    lastName: admin.lastName,
    displayNameTr: null,
    displayNameEn: null,
    positionTr: ADMIN_DEFAULTS.position,
    positionEn: ADMIN_DEFAULTS.position,
    hourlyRate: ADMIN_DEFAULTS.hourlyRate,
    contract: ADMIN_DEFAULTS.contract,
    birthDate: ADMIN_DEFAULTS.birthDate,
    hiredAt: ADMIN_DEFAULTS.hiredAt,
    leaveBalance: SEED_LEAVE_BALANCE,
    phone: ADMIN_DEFAULTS.phone,
    email: admin.email,
    address: ADMIN_DEFAULTS.address,
    role: "admin" as UserRole,
    isTaskRow: false,
    sortOrder: staff.length,
    archivedAt: null,
  };

  return { staff, adminRow, all: [...staff, adminRow] };
}

/**
 * Roster shifts → `Shift` rows. `User` is optional in the schema (`user User?`),
 * so staff get no credentials: only the administrator can sign in.
 */
function buildShiftRows(roster: RosterFile) {
  const idByLabel = new Map(STAFF_BLUEPRINTS.map((staff) => [staff.label, staff.id]));

  return roster.weeks.flatMap((week) =>
    week.shifts.map((shift) => {
      const employeeId = idByLabel.get(shift.employee);
      if (!employeeId) abort(`No blueprint for roster label "${shift.employee}".`);
      // Validated in phase 1, so the `?? 0` is only here to satisfy the types.
      const startMinutes = timeToMinutes(shift.start) ?? 0;
      const endMinutes = timeToMinutes(shift.end) ?? 0;

      return {
        id: `shift-${employeeId}-${shift.date}`,
        employeeId,
        date: shift.date,
        startMinutes,
        endMinutes,
      };
    }),
  );
}

/* -------------------------------------------------- post-import verification */

async function verify(prisma: Client, roster: RosterFile, admin: AdminConfig): Promise<boolean> {
  const failures: string[] = [];
  const expect = (condition: boolean, message: string) => {
    if (!condition) failures.push(message);
  };

  const employees = await prisma.employee.findMany({
    select: { id: true, role: true, isTaskRow: true, archivedAt: true },
  });
  const staffIds = new Set(employees.filter((e) => e.role === "staff").map((e) => e.id));
  const adminIds = employees.filter((e) => e.role === "admin").map((e) => e.id);

  const users = await prisma.user.findMany({ select: { id: true, employeeId: true, email: true } });
  const shifts = await prisma.shift.findMany({
    select: { id: true, employeeId: true, date: true, startMinutes: true, endMinutes: true },
  });
  const leftovers = await countRuntimeRows(prisma);

  expect(employees.length === 10, `Expected 10 employees, found ${employees.length}.`);
  expect(staffIds.size === 9, `Expected 9 staff employees, found ${staffIds.size}.`);
  expect(adminIds.length === 1, `Expected 1 admin employee, found ${adminIds.length}.`);
  expect(
    employees.every((e) => e.archivedAt === null),
    "Some seeded employees are archived; all should be active.",
  );
  expect(
    employees.every((e) => !e.isTaskRow),
    "Some seeded employees are task rows; none should be.",
  );

  // Every id in the table is one we just wrote — nothing survived from the demo seed.
  const expectedIds = new Set([
    ...STAFF_BLUEPRINTS.map((staff) => staff.id),
    ADMIN_DEFAULTS.employeeId,
  ]);
  const strays = employees.filter((e) => !expectedIds.has(e.id)).map((e) => e.id);
  expect(strays.length === 0, `Unexpected employee rows remain: ${strays.join(", ")}.`);

  const adminUsers = users.filter((user) => adminIds.includes(user.employeeId));
  const staffUsers = users.filter((user) => staffIds.has(user.employeeId));
  expect(users.length === 1, `Expected exactly 1 user credential, found ${users.length}.`);
  expect(adminUsers.length === 1, `Expected 1 admin login, found ${adminUsers.length}.`);
  expect(staffUsers.length === 0, `Expected 0 staff logins, found ${staffUsers.length}.`);
  expect(
    adminUsers[0]?.email === admin.email,
    `Admin login email is "${adminUsers[0]?.email ?? "(none)"}", expected "${admin.email}".`,
  );

  expect(
    shifts.length === EXPECTED_SHIFT_COUNT,
    `Expected ${EXPECTED_SHIFT_COUNT} shifts, found ${shifts.length}.`,
  );
  const adminShifts = shifts.filter((shift) => adminIds.includes(shift.employeeId));
  expect(adminShifts.length === 0, `Admin holds ${adminShifts.length} shifts, expected 0.`);
  const orphaned = shifts.filter((shift) => !staffIds.has(shift.employeeId));
  expect(
    orphaned.length === 0,
    `${orphaned.length} shift(s) do not belong to one of the 9 staff employees.`,
  );

  for (const table of ["notification_reads", "notifications", "swap_requests", "leave_requests"]) {
    expect(leftovers[table] === 0, `${table} still holds ${leftovers[table]} row(s).`);
  }

  // Weekly hours, recomputed from what is actually stored, against the source file.
  const idByLabel = new Map(STAFF_BLUEPRINTS.map((staff) => [staff.label, staff.id]));
  const shiftsByEmployeeDate = new Map(
    shifts.map((shift) => [`${shift.employeeId}|${shift.date}`, shift as Shift]),
  );
  const weekReport: Array<{ weekStart: string; ok: boolean; detail: string[] }> = [];

  for (const week of roster.weeks) {
    const dates = weekDates(week.weekStart);
    const detail: string[] = [];

    for (const label of ROSTER_LABELS) {
      const employeeId = idByLabel.get(label);
      if (!employeeId) continue;
      const hours = dates.reduce((total, date) => {
        const shift = shiftsByEmployeeDate.get(`${employeeId}|${date}`);
        return shift ? total + shiftHours(shift) : total;
      }, 0);
      const expected = week.expectedWeeklyHours[label] ?? 0;
      if (hours !== expected) detail.push(`${label} ${hours}h ≠ ${expected}h`);
    }

    weekReport.push({ weekStart: week.weekStart, ok: detail.length === 0, detail });
  }

  const mismatches = weekReport.reduce((total, week) => total + week.detail.length, 0);
  for (const week of weekReport) {
    if (!week.ok) failures.push(`Week ${week.weekStart}: ${week.detail.join(", ")}.`);
  }

  heading("Post-import verification");
  console.log("Employees:");
  console.log(`  Staff: ${staffIds.size}`);
  console.log(`  Admin: ${adminIds.length}`);
  console.log("");
  console.log("Users:");
  console.log(`  Admin login: ${adminUsers.length}`);
  console.log(`  Staff logins: ${staffUsers.length}`);
  console.log("");
  console.log("Shifts:");
  console.log(`  Imported: ${shifts.length}`);
  console.log("");
  console.log("Weeks:");
  for (const week of weekReport) {
    console.log(`  ${week.weekStart} ${week.ok ? "OK" : `MISMATCH — ${week.detail.join(", ")}`}`);
  }
  console.log("");
  console.log("Weekly mismatches:");
  console.log(`  ${mismatches}`);

  if (failures.length > 0) {
    console.error(`\n  ${failures.length} verification failure(s):`);
    for (const message of failures) console.error(`    ✗ ${message}`);
    return false;
  }

  console.log("\n  ✓ All post-import assertions passed.");
  return true;
}

/* --------------------------------------------------------------------- main */

async function main(): Promise<void> {
  const rosterPath = resolve(process.cwd(), ROSTER_PATH);

  // ---- Phase 1: everything that can fail without a connection.
  const admin = readAdminConfig();
  const { roster } = validateRoster(rosterPath);
  console.log(`  ✓ Admin credentials read from the environment (password not shown).`);

  // ---- Phase 2: the guard, the target, and what is about to go.
  heading("Phase 2 · Destructive reset");

  if (process.env[RESET_GUARD_ENV] !== RESET_GUARD_VALUE) {
    abort(
      `Refusing to touch the database.\n` +
        `  Set ${RESET_GUARD_ENV}=${RESET_GUARD_VALUE} to confirm that every\n` +
        `  runtime row may be deleted. Nothing was changed.`,
    );
  }

  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    abort("DIRECT_URL / DATABASE_URL is not set — see .env.example.");
  }

  console.log(`  Target: ${describeTarget(connectionString)}`);
  console.log(`  Guard:  ${RESET_GUARD_ENV} accepted`);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const before = await countRuntimeRows(prisma);
    console.log("  Existing rows to be deleted:");
    for (const table of RUNTIME_TABLES) {
      console.log(`    ${table.padEnd(20)} ${before[table]}`);
    }
    console.log("  Migrations, schema and migration history are left untouched.");

    // ---- Phase 3: reset and seed as one unit.
    heading("Phase 3 · Seed");

    const { staff, adminRow, all } = buildEmployeeRows(admin);
    const shiftRows = buildShiftRows(roster);
    const userRows = [
      {
        id: ADMIN_DEFAULTS.userId,
        email: admin.email,
        passwordHash: admin.passwordHash,
        employeeId: ADMIN_DEFAULTS.employeeId,
      },
    ];

    console.log(`  Staff employees: ${staff.length}`);
    console.log(`  Admin employees: 1 (${adminRow.id}, login ${admin.email})`);
    console.log(`  Shifts to import: ${shiftRows.length}`);

    // One batched transaction: the deletes and the inserts commit together, so a
    // failure halfway cannot leave the panel pointing at an empty database. The
    // deletes run in reverse dependency order regardless of the cascades, which
    // keeps the statement list valid on any Postgres the project is pointed at.
    await prisma.$transaction([
      prisma.notificationRead.deleteMany(),
      prisma.notification.deleteMany(),
      prisma.swapRequest.deleteMany(),
      prisma.leaveRequest.deleteMany(),
      prisma.shift.deleteMany(),
      prisma.user.deleteMany(),
      prisma.employee.deleteMany(),
      prisma.employee.createMany({ data: all }),
      prisma.user.createMany({ data: userRows }),
      prisma.shift.createMany({ data: shiftRows }),
    ]);

    console.log("  ✓ Reset and import committed in a single transaction.");

    const passed = await verify(prisma, roster, admin);
    if (!passed) {
      abort("Post-import verification failed — inspect the database before using the panel.");
    }

    const earliest = shiftRows.reduce((min, s) => (s.date < min ? s.date : min), shiftRows[0].date);
    const latest = shiftRows.reduce((max, s) => (s.date > max ? s.date : max), shiftRows[0].date);
    console.log(
      `\nDone. Roster covers ${earliest} → ${latest}. ` +
        `Sign in as ${admin.email}; staff have no credentials.`,
    );
    console.log(
      `Shift times are stored as minutes from midnight ` +
        `(e.g. ${minutesToTime(shiftRows[0].startMinutes)}).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Called rather than top-level-awaited: the package is CommonJS, so tsx compiles
// this file to CJS where top-level `await` is a syntax error.
main().catch((error) => {
  if (error instanceof AbortError) {
    console.error(`\nAborted: ${error.message}\n`);
  } else {
    console.error(error);
  }
  process.exit(1);
});
