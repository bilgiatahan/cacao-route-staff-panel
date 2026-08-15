import "dotenv/config";

import { defineConfig } from "prisma/config";

/**
 * Prisma 7 configuration.
 *
 * The CLI does not read `.env` on its own any more (hence `dotenv/config`), and
 * the datasource here is the *migration* connection: Supabase's transaction
 * pooler on :6543 cannot run DDL, so migrations go through the session pooler
 * on :5432 (`DIRECT_URL`). The application runtime uses `DATABASE_URL` via the
 * driver adapter in `src/server/db/client.ts`.
 *
 * Seeding is explicit in Prisma 7 — `migrate dev` and `migrate reset` no longer
 * trigger it, so use `npm run db:seed` (or `npm run db:reset`).
 *
 * `process.env` rather than Prisma's `env()` helper on purpose: `env()` throws
 * while the config file is being loaded, which would break `prisma generate`
 * (and therefore `npm install`) on machines that have no database credentials.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
