import "server-only";

import type { User } from "@/types/domain";

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
