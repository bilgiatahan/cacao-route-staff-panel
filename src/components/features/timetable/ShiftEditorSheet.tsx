"use client";

import { useId, useRef, useState } from "react";

import { useActionFeedback } from "@/components/ui/use-action-feedback";

import { Button } from "@/components/ui/Button";
import { Field, FormError, TimeInput } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { clearShiftAction, saveShiftAction } from "@/server/actions/shift.actions";
import type { ActionErrorKey } from "@/server/actions/action-result";

export interface ShiftEditorTarget {
  employeeId: string;
  employeeName: string;
  date: string;
  dayLabel: string;
  startTime: string;
  endTime: string;
  /** False when the cell is currently empty — hides "Clear". */
  hasShift: boolean;
}

export interface ShiftEditorLabels {
  in: string;
  out: string;
  /** Pre-resolved action errors, so a permission failure is not read as a bad time. */
  errorMessages: Record<ActionErrorKey, string>;
  hint: string;
  save: string;
  saving: string;
  clear: string;
  close: string;
  invalid: string;
}

export interface ShiftEditorSheetProps {
  target: ShiftEditorTarget | null;
  labels: ShiftEditorLabels;
  onClose: () => void;
}

export function ShiftEditorSheet({ target, labels, onClose }: ShiftEditorSheetProps) {
  if (!target) return null;

  return (
    <Sheet
      open
      onClose={onClose}
      title={target.employeeName}
      subtitle={target.dayLabel}
      closeLabel={labels.close}
    >
      {/*
        Keyed on the cell so opening a different one remounts the form with
        fresh defaults, instead of syncing props into state via an effect.
      */}
      <EditorForm
        key={`${target.employeeId}-${target.date}`}
        target={target}
        labels={labels}
        onClose={onClose}
      />
    </Sheet>
  );
}

function EditorForm({
  target,
  labels,
  onClose,
}: {
  target: ShiftEditorTarget;
  labels: ShiftEditorLabels;
  onClose: () => void;
}) {
  const [startTime, setStartTime] = useState(target.startTime);
  const [endTime, setEndTime] = useState(target.endTime);
  const [localError, setLocalError] = useState<string | null>(null);
  const errorId = useId();
  const startRef = useRef<HTMLInputElement>(null);
  // Closing on success is the feedback: the cell the sheet was opened from
  // updates behind it, so a "saved" banner would be telling the user what they
  // can already see.
  const { run, pending, error: actionError, clear: clearError } = useActionFeedback(
    labels.errorMessages,
    onClose,
  );

  const error = localError ?? actionError;

  const submit = () => {
    // The one cheap, deterministic check worth doing here: the server still
    // rejects the same range, this just saves the round trip. Focus goes back to
    // the field the user has to change.
    if (endTime <= startTime) {
      setLocalError(labels.invalid);
      startRef.current?.focus();
      return;
    }
    setLocalError(null);
    clearError();
    run(() =>
      saveShiftAction({
        employeeId: target.employeeId,
        date: target.date,
        startTime,
        endTime,
      }),
    );
  };

  const clear = () => {
    setLocalError(null);
    clearError();
    run(() => clearShiftAction(target.employeeId, target.date));
  };

  return (
    <>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <Field label={labels.in} required>
          <TimeInput
            ref={startRef}
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </Field>
        <Field label={labels.out} required>
          <TimeInput
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </Field>
      </div>

      {/* The range is one rule across two controls, so the message describes
          both rather than being pinned to either. */}
      {error ? <FormError id={errorId}>{error}</FormError> : null}

      <p className="mb-3.5 mt-2 text-xs text-muted">{labels.hint}</p>

      <div className="flex gap-2">
        <Button
          size="lg"
          fullWidth
          loading={pending}
          loadingLabel={labels.saving}
          onClick={submit}
          className="justify-start"
        >
          {labels.save}
        </Button>
        {target.hasShift ? (
          <Button variant="outline" size="lg" disabled={pending} onClick={clear}>
            {labels.clear}
          </Button>
        ) : null}
      </div>
    </>
  );
}
