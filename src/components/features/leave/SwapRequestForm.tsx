"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, FormError, Select } from "@/components/ui/Field";
import { Hint, SectionHeading } from "@/components/ui/Section";
import { actionErrorMessage, type ActionResult } from "@/server/actions/action-result";
import { createSwapRequestAction } from "@/server/actions/swap.actions";
import type { Dictionary } from "@/lib/i18n";

export interface SwapOptionView {
  value: string;
  label: string;
}

export interface SwapRequestFormProps {
  dict: Dictionary;
  shiftOptions: SwapOptionView[];
  colleagueOptions: SwapOptionView[];
}

export function SwapRequestForm({
  dict,
  shiftOptions,
  colleagueOptions,
}: SwapRequestFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createSwapRequestAction,
    null,
  );

  // Both controls are selects filled from the server, so a failure cannot be
  // "you typed this wrong" — it is always about the request. Form-level is right.
  const error = state && !state.ok ? actionErrorMessage(state.error, dict) : null;

  return (
    <form action={formAction}>
      <Card padding="md">
        <SectionHeading variant="card" icon="timetable" title={dict.leave.newSwap} />

        {shiftOptions.length === 0 ? (
          <Hint icon="info">{dict.leave.swapNoShift}</Hint>
        ) : (
          <>
            {/* Both selects had only an `aria-label`, so a sighted user had to
                infer which was the shift and which was the colleague. */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Field label={dict.leave.newSwap}>
                <Select name="date">
                  {shiftOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={dict.leave.askSwap}>
                <Select name="targetId">
                  {colleagueOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {error ? (
              <div className="mt-3">
                <FormError>{error}</FormError>
              </div>
            ) : null}

            <Button
              type="submit"
              variant="outline"
              size="lg"
              fullWidth
              loading={pending}
              loadingLabel={dict.leave.sending}
              className="mt-3.5"
            >
              {dict.leave.askSwap}
            </Button>
          </>
        )}
      </Card>
    </form>
  );
}
