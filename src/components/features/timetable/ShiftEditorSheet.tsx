"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Field, FormError, TimeInput } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { clearShiftAction, saveShiftAction } from "@/server/actions/shift.actions";

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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (endTime <= startTime) {
      setError(labels.invalid);
      return;
    }

    startTransition(async () => {
      const result = await saveShiftAction({
        employeeId: target.employeeId,
        date: target.date,
        startTime,
        endTime,
      });
      if (result.ok) onClose();
      else setError(labels.invalid);
    });
  };

  const clear = () => {
    startTransition(async () => {
      await clearShiftAction(target.employeeId, target.date);
      onClose();
    });
  };

  return (
    <>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <Field label={labels.in}>
          <TimeInput
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </Field>
        <Field label={labels.out}>
          <TimeInput value={endTime} onChange={(event) => setEndTime(event.target.value)} />
        </Field>
      </div>

      {error ? <FormError>{error}</FormError> : null}

      <p className="mb-3.5 mt-2 text-xs text-muted">{labels.hint}</p>

      <div className="flex gap-2">
        <Button size="lg" fullWidth disabled={pending} onClick={submit} className="justify-start">
          {pending ? labels.saving : labels.save}
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
