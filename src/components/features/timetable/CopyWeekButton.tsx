"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { Toast } from "@/components/ui/Toast";
import { useActionFeedback } from "@/components/ui/use-action-feedback";
import { useSubmitCount } from "@/components/ui/use-submit-count";
import type { ActionErrorKey } from "@/server/actions/action-result";
import { copyPreviousWeekAction } from "@/server/actions/shift.actions";

export interface CopyWeekLabels {
  /** The button itself, and its shorter form for the dialog's confirm. */
  action: string;
  confirm: string;
  /** Announced while the week is being written; the spinner says nothing alone. */
  pending: string;
  title: string;
  /**
   * The question plus what it will cost, resolved on the server because only the
   * server knows how many shifts either week holds.
   */
  body: string;
  cancel: string;
  close: string;
  done: string;
  /** Why the button is dead when last week has nothing in it. */
  empty: string;
  errorMessages: Record<ActionErrorKey, string>;
}

export interface CopyWeekButtonProps {
  /** The Monday being written into; the action derives the source from it. */
  weekStart: string;
  /** False when last week is empty — the control is shown, but inert. */
  canCopy: boolean;
  labels: CopyWeekLabels;
}

/**
 * Fills the open week with last week's roster, behind a confirmation.
 *
 * The write replaces a whole week and cannot be undone, so it is guarded the
 * same way removing a person is — `ConfirmDialog`, which opens with focus on
 * Cancel. The dialog's body carries the real numbers rather than a vague
 * warning: an admin about to lose five shifts should be told it is five.
 *
 * When last week is empty the button stays on screen and goes disabled with the
 * reason next to it. Hiding it instead would leave an admin looking for a
 * feature that was there last week, and a disabled control with no explanation
 * is the same dead end one step later.
 *
 * Success is reported by a toast rather than by closing something: the grid
 * behind does change, but a week that was already full changes in a way that is
 * easy to miss, and "nothing visibly happened" is exactly what a failed write
 * looks like.
 */
export function CopyWeekButton({ weekStart, canCopy, labels }: CopyWeekButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { run, pending, error } = useActionFeedback(labels.errorMessages, () => {
    setCopied(true);
    setOpen(false);
  });
  // `ACTION_OK` is one shared object, so a second copy carries the identical
  // result; the count is what tells the toast this is a new one.
  const attempt = useSubmitCount(pending);

  const confirm = () => {
    setCopied(false);
    run(() => copyPreviousWeekAction(weekStart));
  };

  return (
    <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:gap-2.5">
      {canCopy ? null : (
        // Sits before the button on a phone so it is read on the way to the
        // control, and to its left on a desk where the row reads across.
        <p className="text-xs text-muted lg:max-w-56 lg:text-right">{labels.empty}</p>
      )}

      <Button
        variant="outline"
        size="md"
        disabled={!canCopy}
        loading={pending}
        loadingLabel={labels.pending}
        onClick={() => setOpen(true)}
        className="w-full gap-2 lg:w-auto"
      >
        <Icon name="copyWeek" className="h-4 w-4" />
        {labels.action}
      </Button>

      <ConfirmDialog
        open={open}
        pending={pending}
        labels={{
          title: labels.title,
          body: labels.body,
          confirm: labels.confirm,
          cancel: labels.cancel,
          close: labels.close,
        }}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />

      <Toast message={error} nonce={attempt} tone="danger" closeLabel={labels.close} />
      <Toast
        message={copied && !error ? labels.done : null}
        nonce={attempt}
        tone="success"
        closeLabel={labels.close}
      />
    </div>
  );
}
