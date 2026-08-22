import "server-only";

import type { Employee } from "@/types/domain";
import type {
  EmployeeModel as EmployeeRow,
  EmployeeOrderByWithRelationInput,
} from "@/generated/prisma/models";

import { createId, isPrismaErrorCode, prisma } from "../db/client";
import { userRepository } from "./user.repository";

export type EmployeeDraft = Omit<Employee, "id" | "archivedAt">;
export type EmployeePatch = Partial<EmployeeDraft>;

/**
 * Roster order: task rows such as "Cleaning" always sit last, everyone else
 * keeps their `sortOrder`. Sorting on `isTaskRow` first means a new hire can
 * simply take the next number without renumbering the task rows.
 */
const ROSTER_ORDER: EmployeeOrderByWithRelationInput[] = [
  { isTaskRow: "asc" },
  { sortOrder: "asc" },
];

function toEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    position: { tr: row.positionTr, en: row.positionEn },
    hourlyRate: Number(row.hourlyRate),
    contract: row.contract,
    birthDate: row.birthDate,
    hiredAt: row.hiredAt,
    leaveBalance: row.leaveBalance,
    phone: row.phone,
    email: row.email,
    address: row.address,
    role: row.role,
    isTaskRow: row.isTaskRow,
    archivedAt: row.archivedAt?.toISOString() ?? null,
  };
}

/** Domain → columns, complete. The two `Localized` fields fan out to two columns each. */
function draftToColumns(draft: EmployeeDraft) {
  return {
    firstName: draft.firstName,
    lastName: draft.lastName,
    positionTr: draft.position.tr,
    positionEn: draft.position.en,
    hourlyRate: draft.hourlyRate,
    contract: draft.contract,
    birthDate: draft.birthDate,
    hiredAt: draft.hiredAt,
    leaveBalance: draft.leaveBalance,
    phone: draft.phone,
    email: draft.email,
    address: draft.address,
    role: draft.role,
    isTaskRow: draft.isTaskRow,
  };
}

/** Same mapping, but only for the keys actually present on the patch. */
function patchToColumns(patch: EmployeePatch) {
  const { position, ...rest } = patch;

  return {
    ...rest,
    ...(position !== undefined ? { positionTr: position.tr, positionEn: position.en } : {}),
  };
}

export const employeeRepository = {
  /** Everyone on the roster, task rows included, in roster order. */
  async list(): Promise<Employee[]> {
    const rows = await prisma.employee.findMany({
      where: { archivedAt: null },
      orderBy: ROSTER_ORDER,
    });
    return rows.map(toEmployee);
  },

  /** Real people only — excludes task rows such as "Cleaning". */
  async listStaff(): Promise<Employee[]> {
    const rows = await prisma.employee.findMany({
      where: { archivedAt: null, isTaskRow: false },
      orderBy: ROSTER_ORDER,
    });
    return rows.map(toEmployee);
  },

  async findById(id: string): Promise<Employee | null> {
    const row = await prisma.employee.findFirst({ where: { id, archivedAt: null } });
    return row ? toEmployee(row) : null;
  },

  async findByEmail(email: string): Promise<Employee | null> {
    const row = await prisma.employee.findFirst({
      where: {
        archivedAt: null,
        email: { equals: email.trim().toLowerCase(), mode: "insensitive" },
      },
    });
    return row ? toEmployee(row) : null;
  },

  /**
   * `passwordHash` is optional: without it the person joins the roster but has no
   * way to sign in, which is the right outcome for a task row or for someone
   * whose account is set up later. With it, employee and login are written in one
   * transaction so a half-created person can never exist.
   */
  async create(draft: EmployeeDraft, passwordHash?: string): Promise<Employee> {
    // New people join at the end of the people section; `ROSTER_ORDER` keeps the
    // task rows below them regardless of the number handed out here.
    const last = await prisma.employee.aggregate({ _max: { sortOrder: true } });
    const sortOrder = (last._max.sortOrder ?? -1) + 1;
    const id = createId("emp");

    const row = await prisma.employee.create({
      data: {
        ...draftToColumns(draft),
        id,
        sortOrder,
        archivedAt: null,
        ...(passwordHash && draft.email
          ? {
              user: {
                create: {
                  id: createId("user"),
                  email: draft.email.trim().toLowerCase(),
                  passwordHash,
                },
              },
            }
          : {}),
      },
    });
    return toEmployee(row);
  },

  async update(id: string, patch: EmployeePatch): Promise<Employee | null> {
    try {
      const row = await prisma.employee.update({ where: { id }, data: patchToColumns(patch) });
      return toEmployee(row);
    } catch (error) {
      if (isPrismaErrorCode(error, "P2025")) return null;
      throw error;
    }
  },

  /**
   * Soft delete: history (shifts, payroll, leave) stays intact and the person
   * simply drops off every active listing.
   *
   * The sign-in credential goes with it, in the same transaction. `User.email`
   * is unique, so a left-behind credential keeps the address claimed and
   * re-hiring the same person fails with `emailTaken` and no way to resolve it
   * from inside the panel. Nothing historical points at `users` — shifts, leave,
   * swaps and notifications all reference `employees` — so the row takes no
   * history with it. The employee row itself is never deleted: every one of
   * those relations cascades on it.
   */
  async archive(id: string): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      // Guarding on `archivedAt: null` in the same statement keeps the
      // "already archived → false" answer correct without a read-then-write race,
      // and stops a second archive from releasing a credential twice.
      const { count } = await tx.employee.updateMany({
        where: { id, archivedAt: null },
        data: { archivedAt: new Date() },
      });
      if (count === 0) return false;

      await userRepository.removeForEmployee(tx, id);
      return true;
    });
  },
};
