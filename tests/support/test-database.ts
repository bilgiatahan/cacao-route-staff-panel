/**
 * Throwaway Postgres for the integration tests.
 *
 * The behaviour under test is transactional rollback, so a mocked Prisma client
 * would prove nothing — these tests need a real server that can really BEGIN,
 * COMMIT and ROLL BACK. Docker is not installed on this machine, so the cluster
 * is created with the Homebrew `initdb`/`pg_ctl` binaries instead: a data
 * directory under /tmp, a non-default port, torn down when the run ends. It
 * never touches the Supabase instance the app uses.
 */

import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Fixed so `vitest.config.ts` can hand the same URL to the test workers. */
export const TEST_PG_PORT = 54329;
export const TEST_PG_DATABASE = "cacao_route_test";
export const TEST_DATABASE_URL = `postgresql://postgres@127.0.0.1:${TEST_PG_PORT}/${TEST_PG_DATABASE}`;

const DATA_ROOT = join(tmpdir(), "cacao-route-test-pg");
const DATA_DIR = join(DATA_ROOT, "data");

/**
 * PostgreSQL 18 on macOS aborts with "postmaster became multithreaded during
 * startup" unless the locale is pinned, so every child process gets `LC_ALL`.
 */
const PG_ENV = { ...process.env, LC_ALL: "C", LANG: "C" };

function resolveBinDir(): string {
  const candidates = [
    "/opt/homebrew/opt/postgresql@18/bin",
    "/opt/homebrew/opt/postgresql@17/bin",
    "/usr/local/opt/postgresql@18/bin",
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
  ];

  const found = candidates.find((dir) => existsSync(join(dir, "initdb")));
  if (!found) {
    throw new Error(
      "No local PostgreSQL found. These are integration tests and need a real server.\n" +
        "Install one with:  brew install postgresql@18",
    );
  }
  return found;
}

const BIN = resolveBinDir();

function pg(binary: string, args: string[]): string {
  return execFileSync(join(BIN, binary), args, {
    env: PG_ENV,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function isRunning(): boolean {
  try {
    pg("pg_isready", ["-h", "127.0.0.1", "-p", String(TEST_PG_PORT), "-q"]);
    return true;
  } catch {
    return false;
  }
}

export function startTestDatabase(): void {
  // A leftover cluster from an interrupted run would still hold the old schema.
  stopTestDatabase();
  rmSync(DATA_ROOT, { recursive: true, force: true });

  pg("initdb", ["-D", DATA_DIR, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--locale=C"]);

  pg("pg_ctl", [
    "-D", DATA_DIR,
    "-o", `-p ${TEST_PG_PORT} -k ${DATA_ROOT} -c listen_addresses=127.0.0.1 -c fsync=off`,
    "-l", join(DATA_ROOT, "server.log"),
    "-w",
    "start",
  ]);

  pg("createdb", ["-h", "127.0.0.1", "-p", String(TEST_PG_PORT), "-U", "postgres", TEST_PG_DATABASE]);
}

export function stopTestDatabase(): void {
  if (!existsSync(DATA_DIR) || !isRunning()) return;
  try {
    pg("pg_ctl", ["-D", DATA_DIR, "-m", "immediate", "-w", "stop"]);
  } catch {
    // Already gone; the directory removal below is what actually matters.
  }
}

export function removeTestDatabase(): void {
  rmSync(DATA_ROOT, { recursive: true, force: true });
}

/**
 * Refuses to run against anything but the throwaway cluster.
 *
 * `prisma.config.ts` calls `dotenv/config`, which would otherwise be free to
 * supply the real Supabase credentials to a command that applies migrations.
 * dotenv does not override variables that are already set, so passing the test
 * URL explicitly is enough — this assertion is the belt to that braces.
 */
export function assertIsTestDatabase(url: string | undefined): asserts url is string {
  const expected = `127.0.0.1:${TEST_PG_PORT}/${TEST_PG_DATABASE}`;
  if (!url || !url.includes(expected)) {
    throw new Error(
      `Refusing to run: DATABASE_URL must point at the throwaway test cluster (${expected}), got: ${url ?? "undefined"}`,
    );
  }
}

export function applyMigrations(): void {
  assertIsTestDatabase(TEST_DATABASE_URL);

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: {
      ...process.env,
      // Both, because prisma.config.ts prefers DIRECT_URL for the migration
      // connection and the runtime adapter reads DATABASE_URL.
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_URL: TEST_DATABASE_URL,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}
