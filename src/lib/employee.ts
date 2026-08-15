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

export function employeeInitials(employee: Employee, locale: Locale): string {
  if (employee.displayName) return employee.displayName[locale].slice(0, 2).toUpperCase();
  return initials(employee.firstName, employee.lastName);
}
