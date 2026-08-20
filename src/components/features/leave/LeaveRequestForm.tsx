"use client";

import { useActionState, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateInput, Field, FormError, TextArea } from "@/components/ui/Field";
import { SectionHeading } from "@/components/ui/Section";
import { cn } from "@/lib/utils";
import { useFieldErrors } from "@/components/ui/use-field-errors";
import { actionErrorMessage, type ActionResult } from "@/server/actions/action-result";
import { createLeaveRequestAction } from "@/server/actions/leave.actions";
import type { Dictionary } from "@/lib/i18n";
import type { LeaveType } from "@/types/domain";

const TYPES: LeaveType[] = ["annual", "sick", "excuse"];

export interface LeaveRequestFormProps {
  dict: Dictionary;
  defaultStart: string;
  defaultEnd: string;
}

/**
 * Staff asking for time off.
 *
 * The remaining balance is not shown here on purpose: it lives in its own card
 * above, because sitting next to the submit button it read as a limit on the
 * request, and nothing in the product enforces one.
 */
export function LeaveRequestForm({
  dict,
  defaultStart,
  defaultEnd,
}: LeaveRequestFormProps) {
  const [type, setType] = useState<LeaveType>("annual");
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createLeaveRequestAction,
    null,
  );

  const formRef = useRef<HTMLFormElement>(null);
  const fields = useFieldErrors(formRef, state, (key) => actionErrorMessage(key, dict));

  return (
    <form ref={formRef} action={formAction}>
      <Card padding="md">
        <SectionHeading variant="card" icon="leave" title={dict.leave.newRequest} />

        <input type="hidden" name="type" value={type} />

        {/* A radio group in behaviour, so it says so; 44px tall and on the
            radius ladder rather than a square hairline strip. */}
        <div
          role="radiogroup"
          aria-label={dict.leave.newRequest}
          className="flex overflow-hidden rounded-md border border-line"
        >
          {TYPES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setType(option)}
              role="radio"
              aria-checked={type === option}
              className={cn(
                "min-h-11 flex-1 px-2 text-sm font-bold transition-colors",
                "focus-visible:outline-offset-[-3px]",
                type === option
                  ? "bg-brand text-white"
                  : "bg-surface text-muted hover:bg-hover hover:text-ink",
              )}
            >
              {dict.leave.types[option]}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {/* The range is one rule, so the message sits on the field the user
              most likely needs to change first. */}
          <Field
            label={dict.leave.start}
            required
            error={fields.errorFor("startDate")}
            errorId={fields.errorId("startDate")}
          >
            <DateInput
              name="startDate"
              defaultValue={defaultStart}
              required
              {...fields.controlProps("startDate")}
            />
          </Field>
          <Field label={dict.leave.end} required>
            <DateInput
              name="endDate"
              defaultValue={defaultEnd}
              required
              aria-describedby={
                fields.errorFor("startDate") ? fields.errorId("startDate") : undefined
              }
            />
          </Field>
        </div>

        {/* The note had no label at all — only a placeholder doing double duty. */}
        <Field label={dict.leave.note} className="mt-3">
          <TextArea name="note" rows={2} placeholder={dict.leave.notePlaceholder} />
        </Field>

        {fields.formError ? (
          <div className="mt-3">
            <FormError>{fields.formError}</FormError>
          </div>
        ) : null}

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={pending}
          loadingLabel={dict.leave.sending}
          className="mt-3.5"
        >
          {dict.leave.send}
        </Button>
      </Card>
    </form>
  );
}
