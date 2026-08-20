"use client";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { useActionFeedback } from "@/components/ui/use-action-feedback";
import { markAllNotificationsReadAction } from "@/server/actions/notification.actions";
import type { ActionErrorKey } from "@/server/actions/action-result";

export interface MarkAllReadButtonProps {
  label: string;
  disabled: boolean;
  errorMessages: Record<ActionErrorKey, string>;
}

/**
 * Was a bare `<button>` with hand-rolled brand text and no busy state: pressing
 * it on a slow connection looked like nothing had happened. It is the shared
 * `Button` now — `ghost` is the variant for a header action, `md` keeps the
 * 44px target the hand-rolled version was careful to reach, and `loading`
 * finally shows the request in flight.
 */
export function MarkAllReadButton({ label, disabled, errorMessages }: MarkAllReadButtonProps) {
  const { run, pending, error } = useActionFeedback(errorMessages);

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
      {error ? <Alert>{error}</Alert> : null}
    </div>
  );
}
