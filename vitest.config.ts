import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { TEST_DATABASE_URL } from "./tests/support/test-database";

const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: `${src}/$1` },
      // `server-only` throws outside a React Server Component. The repositories
      // import it as a guard rail for the app build, not as behaviour, so it is
      // stubbed out rather than worked around.
      {
        find: /^server-only$/,
        replacement: fileURLToPath(new URL("./tests/support/server-only-stub.ts", import.meta.url)),
      },
    ],
  },
  test: {
    // Forks, so every worker inherits the env below and the Prisma client gets
    // a real Node process rather than a worker thread.
    pool: "forks",
    globalSetup: ["./tests/support/global-setup.ts"],
    include: ["tests/**/*.test.ts"],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_URL: TEST_DATABASE_URL,
    },
    // The suites share one database, so they must not interleave.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
