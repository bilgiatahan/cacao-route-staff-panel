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
  | "unexpected";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: ActionErrorKey };

export const ACTION_OK: ActionResult = { ok: true };

export function actionError(error: ActionErrorKey): ActionResult {
  return { ok: false, error };
}

/** Maps a thrown authorisation error onto a result the UI can render. */
export function toActionResult(error: unknown): ActionResult {
  if (error instanceof Error) {
    if (error.message === "UNAUTHENTICATED") return actionError("unauthenticated");
    if (error.message === "FORBIDDEN") return actionError("forbidden");
  }
  return actionError("unexpected");
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
    case "unauthenticated":
    case "forbidden":
    case "notFound":
    case "unexpected":
    default:
      return dict.auth.unexpected;
  }
}
