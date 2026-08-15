import type { tr } from "./dictionaries/tr";

/**
 * Turkish is the reference dictionary; every other locale must match its
 * shape, so a missing key is a type error rather than a runtime blank.
 */
export type Dictionary = typeof tr;
