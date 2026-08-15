"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/Button";
import { FormError, Select } from "@/components/ui/Field";
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

  const error = state && !state.ok ? actionErrorMessage(state.error, dict) : null;

  return (
    <form action={formAction} className="bg-surface-alt px-4 pb-5 pt-3.5">
      <h2 className="mb-2.5 text-xs font-bold uppercase tracking-[0.1em]">
        {dict.leave.newSwap}
      </h2>

      {shiftOptions.length === 0 ? (
        <p className="text-xs text-muted">{dict.leave.swapNoShift}</p>
      ) : (
        <>
          <div className="mb-2.5 grid grid-cols-2 gap-2">
            <Select name="date" aria-label={dict.leave.newSwap}>
              {shiftOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select name="targetId" aria-label={dict.leave.askSwap}>
              {colleagueOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          {error ? <FormError>{error}</FormError> : null}

          <Button type="submit" variant="outline" disabled={pending} className="mt-1 border-ink">
            {pending ? dict.leave.sending : dict.leave.askSwap}
          </Button>
        </>
      )}
    </form>
  );
}
