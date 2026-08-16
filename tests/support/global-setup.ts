import {
  applyMigrations,
  removeTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from "./test-database";

/** Runs once for the whole test run; the returned function tears the cluster down. */
export default function setup() {
  startTestDatabase();
  applyMigrations();

  return () => {
    stopTestDatabase();
    removeTestDatabase();
  };
}
