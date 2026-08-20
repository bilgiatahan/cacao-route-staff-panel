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
  | "passwordTooShort"
  | "accountNeedsEmail"
  | "emailTaken"
  | "emailRequired"
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
 * Every error key resolved in one pass.
 *
 * Client components that trigger a bare-button action need to turn a key into a
 * sentence, but must not receive the whole dictionary to do it. This hands them
 * ~14 short strings instead.
 */
export function actionErrorMessages(dict: Dictionary): Record<ActionErrorKey, string> {
  const keys: ActionErrorKey[] = [
    "unauthenticated",
    "forbidden",
    "notFound",
    "invalidCredentials",
    "invalidRange",
    "invalidTime",
    "nameRequired",
    "passwordTooShort",
    "accountNeedsEmail",
    "emailTaken",
    "emailRequired",
    "currentPasswordRequired",
    "wrongPassword",
    "unexpected",
  ];
  return Object.fromEntries(keys.map((key) => [key, actionErrorMessage(key, dict)])) as Record<
    ActionErrorKey,
    string
  >;
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
    case "passwordTooShort":
      return dict.team.passwordTooShort;
    case "accountNeedsEmail":
      return dict.team.accountNeedsEmail;
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
