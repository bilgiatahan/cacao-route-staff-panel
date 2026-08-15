"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/Button";
import { DateInput, Field, FormError, TextArea } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { actionErrorMessage, type ActionResult } from "@/server/actions/action-result";
import { createLeaveRequestAction } from "@/server/actions/leave.actions";
import type { Dictionary } from "@/lib/i18n";
import type { LeaveType } from "@/types/domain";

const TYPES: LeaveType[] = ["annual", "sick", "excuse"];

export interface LeaveRequestFormProps {
  dict: Dictionary;
  balanceLabel: string;
  defaultStart: string;
  defaultEnd: string;
}

export function LeaveRequestForm({
  dict,
  balanceLabel,
  defaultStart,
  defaultEnd,
}: LeaveRequestFormProps) {
  const [type, setType] = useState<LeaveType>("annual");
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createLeaveRequestAction,
    null,
  );

  const error = state && !state.ok ? actionErrorMessage(state.error, dict) : null;

  return (
    <form action={formAction} className="border-t-2 border-ink bg-surface-alt px-4 pb-4.5 pt-3.5">
      <h2 className="mb-2.5 text-xs font-bold uppercase tracking-[0.1em]">
        {dict.leave.newRequest}
      </h2>

      <input type="hidden" name="type" value={type} />
      <div className="mb-2.5 flex border border-line-strong">
        {TYPES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setType(option)}
            aria-pressed={type === option}
            className={cn(
              "flex-1 border-r border-line px-1 py-2.5 text-xs font-bold last:border-r-0",
              type === option ? "bg-brand text-white" : "bg-surface text-ink hover:bg-hover",
            )}
          >
            {dict.leave.types[option]}
          </button>
        ))}
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <Field label={dict.leave.start}>
          <DateInput name="startDate" defaultValue={defaultStart} required />
        </Field>
        <Field label={dict.leave.end}>
          <DateInput name="endDate" defaultValue={defaultEnd} required />
        </Field>
      </div>

      <TextArea
        name="note"
        rows={2}
        placeholder={dict.leave.notePlaceholder}
        className="mb-2.5"
      />

      {error ? <FormError>{error}</FormError> : null}

      <div className="mt-2.5 flex items-center justify-between gap-2.5">
        <span className="text-xs text-muted">{balanceLabel}</span>
        <Button type="submit" disabled={pending}>
          {pending ? dict.leave.sending : dict.leave.send}
        </Button>
      </div>
    </form>
  );
}
