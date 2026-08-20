import type { ActionErrorKey } from "@/server/actions/action-result";

/**
 * Which control an action error belongs to.
 *
 * Server actions return one `ActionErrorKey`, not a field name — and they do not
 * need to. Every key already implies its control: `emailTaken` can only be about
 * the email, `wrongPassword` can only be about the current password. Mapping
 * that here keeps the action contracts untouched while letting a form point at
 * the field that is actually wrong instead of showing one banner for everything.
 *
 * `null` forces a key to stay form-level in a particular form, for cases where
 * the same key means something less specific there.
 */
export type FieldMap = Partial<Record<ActionErrorKey, string | null>>;

export const DEFAULT_FIELD_MAP: FieldMap = {
  nameRequired: "firstName",
  emailRequired: "email",
  emailTaken: "email",
  accountNeedsEmail: "email",
  passwordTooShort: "password",
  currentPasswordRequired: "currentPassword",
  wrongPassword: "currentPassword",
  invalidRange: "startDate",
  invalidTime: "startTime",
};

/**
 * Keys that must never be pinned to a control.
 *
 * `invalidCredentials` is the interesting one: the server deliberately does not
 * say whether the address or the password was wrong, and putting the error on
 * either field would invent information it withheld. The rest are about the
 * request, not the input.
 */
export const FORM_LEVEL_KEYS: readonly ActionErrorKey[] = [
  "invalidCredentials",
  "unauthenticated",
  "forbidden",
  "notFound",
  "unexpected",
];

/** The control an error belongs to, or `null` when it belongs to the form. */
export function fieldForError(
  key: ActionErrorKey,
  fieldMap: FieldMap = DEFAULT_FIELD_MAP,
): string | null {
  if (FORM_LEVEL_KEYS.includes(key)) return null;
  return fieldMap[key] ?? null;
}
