"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

export interface ConfirmDialogLabels {
  title: string;
  /** What will happen, in plain terms. */
  body: string;
  confirm: string;
  cancel: string;
  close: string;
}

export interface ConfirmDialogProps {
  open: boolean;
  labels: ConfirmDialogLabels;
  /** Disables both controls while the action it guards is in flight. */
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Replaces `window.confirm` for destructive actions.
 *
 * Built on `Sheet`, so it inherits scroll lock, the scrim and Escape-to-close.
 * Focus lands on **Cancel** rather than Confirm: for an irreversible action the
 * safe choice should be the one a stray Enter hits. Focus returns to whatever
 * opened the dialog when it closes.
 */
export function ConfirmDialog({
  open,
  labels,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;

    openerRef.current = document.activeElement;
    cancelRef.current?.focus();

    return () => {
      const opener = openerRef.current;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <Sheet open onClose={onCancel} title={labels.title} closeLabel={labels.close} className="lg:bottom-1/2 lg:translate-y-1/2 lg:rounded-md">
      <p className="mb-3.5 text-base text-muted">{labels.body}</p>
      <div className="flex gap-2">
        <Button
          ref={cancelRef}
          variant="outline"
          size="lg"
          fullWidth
          disabled={pending}
          onClick={onCancel}
        >
          {labels.cancel}
        </Button>
        <Button variant="danger" size="lg" fullWidth loading={pending} onClick={onConfirm}>
          {labels.confirm}
        </Button>
      </div>
    </Sheet>
  );
}
