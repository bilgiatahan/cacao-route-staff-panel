"use client";

import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { useSubmitCount } from "@/components/ui/use-submit-count";
import { useActionFeedback } from "@/components/ui/use-action-feedback";
import { markAllNotificationsReadAction } from "@/server/actions/notification.actions";
import type { ActionErrorKey } from "@/server/actions/action-result";

export interface MarkAllReadButtonProps {
  label: string;
  disabled: boolean;
  errorMessages: Record<ActionErrorKey, string>;
  /** `dict.common.close` — the toast's dismiss button needs a name. */
  closeLabel: string;
}

/**
 * Was a bare `<button>` with hand-rolled brand text and no busy state: pressing
 * it on a slow connection looked like nothing had happened. It is the shared
 * `Button` now — `ghost` is the variant for a header action, `md` keeps the
 * 44px target the hand-rolled version was careful to reach, and `loading`
 * finally shows the request in flight.
 */
export function MarkAllReadButton({
  label,
  disabled,
  errorMessages,
  closeLabel,
}: MarkAllReadButtonProps) {
  const { run, pending, error } = useActionFeedback(errorMessages);
  const attempt = useSubmitCount(pending);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        variant="ghost"
        disabled={disabled}
        loading={pending}
        loadingLabel={label}
        onClick={() => run(() => markAllNotificationsReadAction())}
      >
        {label}
      </Button>
      {/* One button acting on the whole list, so its failure belongs to the
          page rather than to any row — a toast, not an inline block. */}
      <Toast message={error} nonce={attempt} closeLabel={closeLabel} />
    </div>
  );
}
