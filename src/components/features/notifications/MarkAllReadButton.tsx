"use client";

import { Alert } from "@/components/ui/Alert";
import { useActionFeedback } from "@/components/ui/use-action-feedback";
import { markAllNotificationsReadAction } from "@/server/actions/notification.actions";
import type { ActionErrorKey } from "@/server/actions/action-result";

export interface MarkAllReadButtonProps {
  label: string;
  disabled: boolean;
  errorMessages: Record<ActionErrorKey, string>;
}

export function MarkAllReadButton({ label, disabled, errorMessages }: MarkAllReadButtonProps) {
  const { run, pending, error } = useActionFeedback(errorMessages);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => run(() => markAllNotificationsReadAction())}
        // 44px of hit area without changing how the label reads.
        className="inline-flex min-h-11 items-center px-2 text-xs font-bold text-brand hover:text-brand-dark disabled:text-muted"
      >
        {label}
      </button>
      {error ? <Alert>{error}</Alert> : null}
    </div>
  );
}
