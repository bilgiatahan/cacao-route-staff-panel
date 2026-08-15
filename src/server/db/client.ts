import "server-only";

import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * The database connection.
 *
 * This is the only module in the project that imports the generated Prisma
 * client, and the repositories in `../repositories` are the only modules allowed
 * to import this one. Everything above them speaks `src/types/domain.ts` and has
 * no idea Postgres is involved.
 *
 * Kept on `globalThis` so the dev server's hot reload reuses one connection pool
 * instead of opening a new one on every edit.
 */
type Client = InstanceType<typeof PrismaClient>;

const globalStore = globalThis as typeof globalThis & {
  __cacaoRoutePrisma?: Client;
};

function createClient(): Client {
  // Prisma 7 requires a driver adapter; the runtime connection is the pooled
  // one (`DATABASE_URL`), while migrations use `DIRECT_URL` via prisma.config.ts.
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — copy .env.example to .env.local and fill it in.");
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

function getClient(): Client {
  globalStore.__cacaoRoutePrisma ??= createClient();
  return globalStore.__cacaoRoutePrisma;
}

/**
 * Connecting lazily, on first property access, rather than at import time.
 * `next build` imports every page module to collect route configuration, so an
 * eagerly-constructed client would make a build impossible without database
 * credentials — and would open a pool per build worker when they are present.
 */
export const prisma: Client = new Proxy({} as Client, {
  get(_target, property) {
    const client = getClient();
    const value = Reflect.get(client, property, client);
    // `$transaction`, `$disconnect` and friends need their original receiver;
    // model delegates are plain objects and carry their own binding.
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/**
 * Ids stay human-readable and prefixed, matching the seeded `emp-2` / `leave-1`
 * style, so a row is recognisable at a glance in the Supabase table editor.
 */
export function createId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Narrow a thrown value to a Prisma error with a given code, so repositories can
 * turn an expected failure into their documented return value instead of letting
 * it escape. The two that come up here:
 *
 *   P2002 — unique constraint violated (row already exists)
 *   P2025 — record required by the operation was not found
 */
export function isPrismaErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
