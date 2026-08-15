import "server-only";

import { cache } from "react";

import { redirect } from "next/navigation";

import { fullName } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { employeeRepository } from "@/server/repositories/employee.repository";
import type { Employee, SessionUser } from "@/types/domain";

import { auth } from "./index";

/**
 * Data access layer entry point.
 *
 * Every page, service and server action resolves the caller through these
 * helpers rather than trusting the proxy — the proxy only does an optimistic
 * cookie check, so authorisation has to be enforced next to the data.
 */

/**
 * Wrapped in React's `cache` so the layout, the page and the nav badges all
 * share one lookup: without it a single render issues the employee query several
 * times over, which was free against the in-memory store and is a round trip to
 * Postgres now. The cache is per-request, so a role change still takes effect on
 * the very next navigation.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.employeeId) return null;

  // Re-read the employee so a role change or removal takes effect immediately
  // instead of living on inside an already-issued JWT.
  const employee = await employeeRepository.findById(session.user.employeeId);
  if (!employee) return null;

  return {
    userId: session.user.id,
    employeeId: employee.id,
    email: employee.email,
    role: employee.role,
    fullName: fullName(employee.firstName, employee.lastName),
  };
});

/** The full employee row behind the session, deduplicated the same way. */
const getCurrentEmployee = cache(async (employeeId: string): Promise<Employee | null> => {
  return employeeRepository.findById(employeeId);
});

/** Redirects to the login page when there is no valid session. */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(ROUTES.login);
  return user;
}

/** Like `requireSessionUser`, but bounces non-admins back to their summary. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireSessionUser();
  if (user.role !== "admin") redirect(ROUTES.summary);
  return user;
}

/** The employee record behind the current session. */
export async function requireCurrentEmployee(): Promise<{
  user: SessionUser;
  employee: Employee;
}> {
  const user = await requireSessionUser();
  const employee = await getCurrentEmployee(user.employeeId);
  if (!employee) redirect(ROUTES.login);
  return { user, employee };
}

/** Throws instead of redirecting — the right shape for server actions. */
export async function assertAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  if (user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}

export async function assertAuthenticated(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
