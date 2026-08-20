import "server-only";

import type { User } from "@/types/domain";
import type { Prisma } from "@/generated/prisma/client";

import { createId, prisma } from "../db/client";

export const userRepository = {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  },

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  async findByEmployeeId(employeeId: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { employeeId } });
  },

  /**
   * Moves an existing login to a new address, leaving the password alone. The
   * employee's email doubles as the sign-in identifier, so the two have to move
   * together when someone edits their own contact details.
   */
  async updateEmail(employeeId: string, email: string): Promise<User | null> {
    const { count } = await prisma.user.updateMany({
      where: { employeeId },
      data: { email: email.trim().toLowerCase() },
    });
    if (count === 0) return null;
    return prisma.user.findUnique({ where: { employeeId } });
  },

  /**
   * Removes an employee's sign-in credential.
   *
   * Takes the caller's transaction client rather than opening its own: the
   * credential has to be released in the same transaction as the archive that
   * triggered it (see `employeeRepository.archive`), so the boundary belongs to
   * the caller. `deleteMany` rather than `delete` because an employee may never
   * have had a login at all — a task row, or an account set up later — and that
   * is not an error.
   */
  async removeForEmployee(
    tx: Prisma.TransactionClient,
    employeeId: string,
  ): Promise<boolean> {
    const { count } = await tx.user.deleteMany({ where: { employeeId } });
    return count > 0;
  },

  /**
   * Gives an employee a login, or replaces the one they have. Hashing happens in
   * the caller — this layer only stores what it is handed.
   */
  async upsertCredentials(
    employeeId: string,
    email: string,
    passwordHash: string,
  ): Promise<User> {
    const normalized = email.trim().toLowerCase();

    return prisma.user.upsert({
      where: { employeeId },
      create: { id: createId("user"), email: normalized, passwordHash, employeeId },
      update: { email: normalized, passwordHash },
    });
  },
};
