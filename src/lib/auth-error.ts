/**
 * The typed failure an authorisation guard raises.
 *
 * This replaces `throw new Error("FORBIDDEN")` paired with a later
 * `error.message === "FORBIDDEN"`. Both halves of that were invisible to the
 * compiler: a typo in either one turned a real permission failure into a
 * generic "unexpected" error, and any unrelated `Error` that happened to carry
 * the same message was promoted into a permission failure. In the panel's only
 * authorisation channel neither is acceptable.
 *
 * It lives under `lib/` rather than beside the guards because both ends need
 * it: `server/auth/session.ts` throws it, and `server/actions/action-result.ts`
 * narrows on it — and that module is imported by client components, so it can
 * never reach anything marked `server-only`.
 */

/**
 * Why the check failed.
 *
 * Deliberately a subset of `ActionErrorKey`, which is what lets
 * `toActionResult` pass a kind straight to `actionError` with no lookup table.
 * Rename either union and that call stops compiling.
 */
export type AuthErrorKind = "unauthenticated" | "forbidden";

export class AuthorizationError extends Error {
  /**
   * `super(kind)` keeps `message` populated, so anything that logs the error
   * reads the same as it did when the kind *was* the message.
   */
  constructor(readonly kind: AuthErrorKind) {
    super(kind);
    this.name = "AuthorizationError";
  }
}
