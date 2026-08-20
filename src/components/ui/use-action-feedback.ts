"use client";

import { useCallback, useState, useTransition } from "react";

import type { ActionErrorKey, ActionResult } from "@/server/actions/action-result";

/**
 * Runs a server action that is not attached to a form, and keeps its result.
 *
 * The six actions triggered by a bare button — approve, reject, archive, clear a
 * shift, mark one notification read, mark all read — each used to `await` an
 * `ActionResult` and throw it away, so a failure was invisible. This gives them
 * all the same handling in one place.
 *
 * `messages` is a pre-resolved key → sentence map built on the server, so the
 * dictionary itself never has to cross into the client.
 */
export interface ActionFeedback {
  /** True while the action is in flight; wire it to `disabled`. */
  pending: boolean;
  /** A localised sentence, or `null` when the last run succeeded. */
  error: string | null;
  run: (action: () => Promise<ActionResult>) => void;
  clear: () => void;
}

export function useActionFeedback(
  messages: Record<ActionErrorKey, string>,
  onSuccess?: () => void,
): ActionFeedback {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    (action: () => Promise<ActionResult>) => {
      setError(null);
      startTransition(async () => {
        try {
          const result = await action();
          if (result.ok) onSuccess?.();
          else setError(messages[result.error] ?? messages.unexpected);
        } catch {
          // A thrown action still has to say something. `redirect()` throws by
          // design, but those actions are wired through `useActionState`, not
          // this hook, so anything landing here is a genuine failure.
          setError(messages.unexpected);
        }
      });
    },
    [messages, onSuccess],
  );

  return { pending, error, run, clear: () => setError(null) };
}
