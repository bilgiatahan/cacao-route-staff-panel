import { fullName, initials } from "@/lib/format";
import type { Employee, Locale } from "@/types/domain";

/**
 * Task rows ("Cleaning") carry a translated label; real people are shown by
 * name. Everything user-facing goes through these helpers so the two cases
 * never have to be special-cased at the call site.
 */

export function employeeDisplayName(employee: Employee, locale: Locale): string {
  return employee.displayName?.[locale] ?? employee.firstName;
}

export function employeeFullName(employee: Employee, locale: Locale): string {
  if (employee.displayName) return employee.displayName[locale];
  return fullName(employee.firstName, employee.lastName);
}

export function employeePosition(employee: Employee, locale: Locale): string {
  return employee.position[locale] || employee.position.tr;
}

/**
 * Whether someone occupies an operational roster row.
 *
 * Admins run the schedule rather than appear on it. Left in, an administrator
 * with no shifts renders as a permanently empty row on the timetable and still
 * counts towards headcount, payroll and coverage — a manager costing the wage
 * bill nothing and showing seven blank days.
 *
 * Task rows ("Cleaning") deliberately stay: they are scheduled work that simply
 * is not a person, and `isTaskRow` already excludes them from headcount and pay.
 *
 * This is the only definition of the rule; `getRosterWeek` applies it once for
 * every screen, and `role` is seed-only — `createEmployeeAction` hard-codes
 * `"staff"` — so a row cannot drift out of the roster from inside the panel.
 */
export function isRosterMember(employee: Employee): boolean {
  return employee.role !== "admin";
}

export function employeeInitials(employee: Employee, locale: Locale): string {
  if (employee.displayName) return employee.displayName[locale].slice(0, 2).toUpperCase();
  return initials(employee.firstName, employee.lastName);
}
