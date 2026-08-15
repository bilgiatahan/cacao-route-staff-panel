export type ClassValue = string | false | null | undefined;

/** Minimal class joiner — the design has no conflicting-variant problem to solve. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
