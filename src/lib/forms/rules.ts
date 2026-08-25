import { toIsoDate } from "@/lib/date";
import { UK_PHONE_LENGTH } from "@/lib/forms/phone-uk";
import type { IsoDate } from "@/types/domain";

/**
 * Input rules, written once and read by both sides.
 *
 * The server checks can never be removed — a Server Function is reachable by a
 * plain POST, so the browser's opinion of a value is a convenience, not a
 * guarantee. That is exactly why the numbers and the patterns live here instead
 * of being typed into the JSX and then again into the action: a form spreads
 * `inputProps(rule)` onto its control, the action calls `violates(value, rule)`,
 * and there is one place to change either.
 *
 * `pattern` is deliberately a *string* rather than a `RegExp`, because that is
 * what the DOM attribute takes. `violates` compiles it with the same implicit
 * anchoring HTML applies (`^(?:…)$`, whole value must match), so the two sides
 * cannot disagree about what the pattern means.
 */

export interface TextRule {
  required?: boolean;
  minLength?: number;
  maxLength: number;
  /** HTML `pattern` semantics: anchored, and skipped for an empty value. */
  pattern?: string;
}

/**
 * Phone numbers are UK numbers.
 *
 * The panel runs in London — `£`, `en-GB`, a roster of London addresses — so the
 * field masks and validates against the UK numbering plan rather than accepting
 * anything with digits in it. The grouping and the real check both live in
 * `phone-uk.ts`; the length bounds here are only the coarse gate the browser can
 * apply on its own, and they are *derived* from that module so the two cannot
 * drift.
 *
 * No `pattern`: a regex covering every UK grouping would be a second, weaker
 * copy of `isValidUkPhone`. The mask keeps the shape correct as it is typed, the
 * length catches an incomplete number, and the action has the only semantic rule.
 */

/**
 * Email, loosely, and only on the server.
 *
 * The control uses `type="email"`, whose built-in check is better than any regex
 * written here and comes with the right keyboard on a phone. This is the floor
 * underneath it for the crafted-POST path — an address is ultimately proven by
 * being able to sign in with it, not by matching a pattern.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * The person fields both forms edit.
 *
 * `PERSON_RULES`, not `PROFILE_RULES`: the manager's `EmployeeForm` edits the
 * same firstName, phone and address as the person's own `ProfileForm`, and two
 * forms holding different rules for one field is how a number an admin can save
 * becomes one its owner cannot.
 */
export const PERSON_RULES = {
  firstName: { required: true, minLength: 2, maxLength: 40 },
  lastName: { maxLength: 40 },
  /** Job title. Only the manager's form has this one. */
  position: { maxLength: 60 },
  email: { required: true, maxLength: 160 },
  phone: { minLength: UK_PHONE_LENGTH.min, maxLength: UK_PHONE_LENGTH.max },
  address: { maxLength: 200 },
} as const satisfies Record<string, TextRule>;

/**
 * Passwords.
 *
 * The ceiling is not arbitrary: bcrypt hashes at most 72 **bytes** and silently
 * ignores everything after, so a longer password would appear to be accepted
 * while only its first 72 bytes ever mattered. Rejecting is the honest answer.
 * Note bytes, not characters — "ş" costs two — which is why `passwordByteLength`
 * exists rather than a `.length` check.
 */
export const PASSWORD_RULE = { minLength: 8, maxLength: 72 } as const;

/** UTF-8 byte length, the unit bcrypt actually counts in. */
export function passwordByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/**
 * Plausible birth dates for someone on a payroll.
 *
 * A typo guard, not an eligibility rule: the point is to catch "2026-08-01"
 * entered for a birthday, not to encode employment law. The manager sets who is
 * on the roster; this only stops a date that cannot belong to a living employee.
 */
export const MIN_AGE_YEARS = 14;
export const MAX_AGE_YEARS = 100;

export function birthDateBounds(reference: Date = new Date()): {
  min: IsoDate;
  max: IsoDate;
} {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const day = reference.getDate();

  return {
    min: toIsoDate(new Date(year - MAX_AGE_YEARS, month, day)),
    max: toIsoDate(new Date(year - MIN_AGE_YEARS, month, day)),
  };
}

/* ------------------------------------------------------------------ client -- */

/** The rule as DOM attributes, for spreading onto a control. */
export function inputProps(rule: TextRule): {
  required?: true;
  minLength?: number;
  maxLength: number;
  pattern?: string;
} {
  return {
    ...(rule.required ? { required: true as const } : {}),
    ...(rule.minLength !== undefined ? { minLength: rule.minLength } : {}),
    maxLength: rule.maxLength,
    ...(rule.pattern !== undefined ? { pattern: rule.pattern } : {}),
  };
}

/* ------------------------------------------------------------------ server -- */

/** Why a value failed, or `null` when it is fine. */
export type RuleViolation = "required" | "tooShort" | "tooLong" | "pattern";

/**
 * Checks a trimmed value against a rule.
 *
 * An empty optional value passes every other check — the same way HTML skips
 * `pattern` and `minLength` for an empty non-required control. Without that, an
 * optional phone field would demand seven characters of nothing.
 */
export function violates(value: string, rule: TextRule): RuleViolation | null {
  if (!value) return rule.required ? "required" : null;

  if (rule.minLength !== undefined && value.length < rule.minLength) return "tooShort";
  if (value.length > rule.maxLength) return "tooLong";

  if (rule.pattern !== undefined && !new RegExp(`^(?:${rule.pattern})$`).test(value)) {
    return "pattern";
  }

  return null;
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

/** Whether an ISO birth date sits inside the plausible window. */
export function isPlausibleBirthDate(iso: IsoDate, reference: Date = new Date()): boolean {
  const { min, max } = birthDateBounds(reference);
  // ISO dates compare lexicographically, which for `YYYY-MM-DD` is chronologically.
  return iso >= min && iso <= max;
}
