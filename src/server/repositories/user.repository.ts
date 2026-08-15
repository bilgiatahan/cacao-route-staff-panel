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
