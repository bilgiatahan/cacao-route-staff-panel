import { AuthorizationError } from "@/lib/auth-error";
import type { Dictionary } from "@/lib/i18n";

/**
 * Server actions return an error *key*, not a sentence — the client picks the
 * wording out of the active dictionary, so mutations stay language-agnostic.
 */
export type ActionErrorKey =
  | "unauthenticated"
  | "forbidden"
  | "notFound"
  | "invalidCredentials"
  | "invalidRange"
  | "invalidTime"
  | "nameRequired"
  | "nameTooShort"
  | "passwordTooShort"
  | "passwordTooLong"
  | "passwordMismatch"
  | "passwordUnchanged"
  | "accountNeedsEmail"
  | "noAccount"
  | "emailTaken"
  | "emailRequired"
  | "invalidEmail"
  | "invalidPhone"
  | "invalidBirthDate"
  | "valueTooLong"
  | "currentPasswordRequired"
  | "wrongPassword"
  | "unexpected";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: ActionErrorKey };

export const ACTION_OK: ActionResult = { ok: true };

export function actionError(error: ActionErrorKey): ActionResult {
  return { ok: false, error };
}

/**
 * Maps a thrown authorisation error onto a result the UI can render.
 *
 * `AuthErrorKind` is a subset of `ActionErrorKey`, so the kind passes straight
 * through — rename either union and this stops compiling. Anything that is not
 * an `AuthorizationError` is not an authorisation failure and must not be
 * reported as one.
 */
export function toActionResult(error: unknown): ActionResult {
  if (error instanceof AuthorizationError) return actionError(error.kind);
  return actionError("unexpected");
}

/**
 * Every key in the union, as a value.
 *
 * A record checked with `satisfies` rather than a hand-kept array: an array is
 * typed `ActionErrorKey[]`, so leaving a key out of it compiles cleanly and the
 * key then silently vanishes from `actionErrorMessages`. This way, adding a
 * member to the union without listing it here is a compile error.
 */
const ERROR_KEYS = {
  unauthenticated: true,
  forbidden: true,
  notFound: true,
  invalidCredentials: true,
  invalidRange: true,
  invalidTime: true,
  nameRequired: true,
  nameTooShort: true,
  passwordTooShort: true,
  passwordTooLong: true,
  passwordMismatch: true,
  passwordUnchanged: true,
  accountNeedsEmail: true,
  noAccount: true,
  emailTaken: true,
  emailRequired: true,
  invalidEmail: true,
  invalidPhone: true,
  invalidBirthDate: true,
  valueTooLong: true,
  currentPasswordRequired: true,
  wrongPassword: true,
  unexpected: true,
} as const satisfies Record<ActionErrorKey, true>;

export const ALL_ERROR_KEYS = Object.keys(ERROR_KEYS) as ActionErrorKey[];

/**
 * Every error key resolved in one pass.
 *
 * Client components that trigger a bare-button action need to turn a key into a
 * sentence, but must not receive the whole dictionary to do it. This hands them
 * a couple of dozen short strings instead.
 */
export function actionErrorMessages(dict: Dictionary): Record<ActionErrorKey, string> {
  return Object.fromEntries(
    ALL_ERROR_KEYS.map((key) => [key, actionErrorMessage(key, dict)]),
  ) as Record<ActionErrorKey, string>;
}

export function actionErrorMessage(error: ActionErrorKey, dict: Dictionary): string {
  switch (error) {
    case "invalidCredentials":
      return dict.auth.invalid;
    case "invalidRange":
      return dict.leave.invalidRange;
    case "invalidTime":
      return dict.timetable.editorInvalid;
    case "nameRequired":
      return dict.team.nameRequired;
    case "nameTooShort":
      return dict.profile.nameTooShort;
    case "passwordTooShort":
      return dict.team.passwordTooShort;
    case "passwordTooLong":
      return dict.profile.passwordTooLong;
    case "passwordMismatch":
      return dict.profile.passwordMismatch;
    case "passwordUnchanged":
      return dict.profile.passwordUnchanged;
    case "accountNeedsEmail":
      return dict.team.accountNeedsEmail;
    case "noAccount":
      return dict.profile.noAccount;
    case "invalidEmail":
      return dict.profile.invalidEmail;
    case "invalidPhone":
      return dict.profile.invalidPhone;
    case "invalidBirthDate":
      return dict.profile.invalidBirthDate;
    case "valueTooLong":
      return dict.profile.valueTooLong;
    case "emailTaken":
      return dict.team.emailTaken;
    case "emailRequired":
      return dict.profile.emailRequired;
    case "currentPasswordRequired":
      return dict.profile.currentPasswordRequired;
    case "wrongPassword":
      return dict.profile.wrongPassword;
    case "unauthenticated":
    case "forbidden":
    case "notFound":
    case "unexpected":
    default:
      return dict.auth.unexpected;
  }
}
