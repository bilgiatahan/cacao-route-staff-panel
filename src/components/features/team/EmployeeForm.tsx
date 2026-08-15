"use client";

import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import {
  DateInput,
  Field,
  FieldLabel,
  FormError,
  NumberInput,
  TextArea,
  TextInput,
} from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { actionErrorMessage, type ActionResult } from "@/server/actions/action-result";
import type { Dictionary } from "@/lib/i18n";
import type { ContractType } from "@/types/domain";

export interface EmployeeFormValues {
  firstName: string;
  lastName: string;
  position: string;
  contract: ContractType;
  birthDate: string;
  hiredAt: string;
  hourlyRate: number;
  leaveBalance: number;
  phone: string;
  email: string;
  address: string;
}

export interface EmployeeFormProps {
  dict: Dictionary;
  mode: "create" | "edit";
  values: EmployeeFormValues;
  action: (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  /**
   * Archiving is unavailable for task rows and for the signed-in admin, so its
   * absence does not imply a new person — hence the explicit `mode`.
   */
  onArchive?: () => Promise<ActionResult>;
  /**
   * Whether this person already has a login. Only changes the hint under the
   * password field — an empty field never touches an existing account.
   */
  hasAccount?: boolean;
}

const CONTRACTS: ContractType[] = ["full", "part"];

export function EmployeeForm({
  dict,
  mode,
  values,
  action,
  onArchive,
  hasAccount = false,
}: EmployeeFormProps) {
  const [contract, setContract] = useState<ContractType>(values.contract);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    action,
    null,
  );
  const [archiving, startArchive] = useTransition();

  const error = state && !state.ok ? actionErrorMessage(state.error, dict) : null;
  const saved = state?.ok === true;

  const archive = () => {
    if (!onArchive) return;
    if (!window.confirm(dict.team.removeConfirm)) return;
    startArchive(async () => {
      await onArchive();
    });
  };

  return (
    <form action={formAction}>
      <h2 className="label-eyebrow px-4 pb-1 pt-3.5">{dict.team.personal}</h2>
      <div className="grid grid-cols-2 gap-2.5 px-4 pb-3">
        <Field label={dict.team.firstName}>
          <TextInput name="firstName" defaultValue={values.firstName} required />
        </Field>
        <Field label={dict.team.lastName}>
          <TextInput name="lastName" defaultValue={values.lastName} />
        </Field>
        <Field label={dict.team.birth}>
          <DateInput name="birthDate" defaultValue={values.birthDate} />
        </Field>
        <Field label={dict.team.hired}>
          <DateInput name="hiredAt" defaultValue={values.hiredAt} />
        </Field>
      </div>

      <h2 className="label-eyebrow px-4 pb-1 pt-1.5">{dict.team.employment}</h2>
      <div className="flex flex-col gap-2.5 px-4 pb-3">
        <Field label={dict.team.position}>
          <TextInput
            name="position"
            defaultValue={values.position}
            placeholder={dict.team.positionPlaceholder}
          />
        </Field>

        <div className="flex flex-col gap-1">
          <FieldLabel>{dict.team.contract}</FieldLabel>
          <input type="hidden" name="contract" value={contract} />
          <div className="flex border border-line-strong">
            {CONTRACTS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setContract(option)}
                aria-pressed={contract === option}
                className={cn(
                  "flex-1 px-1 py-2.5 text-sm font-bold",
                  contract === option
                    ? "bg-brand text-white"
                    : "bg-surface text-ink hover:bg-hover",
                )}
              >
                {dict.team.contracts[option]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Field label={dict.team.wage}>
            <NumberInput name="hourlyRate" defaultValue={values.hourlyRate} min={0} step={5} />
          </Field>
          <Field label={dict.team.leaveBalance}>
            <NumberInput name="leaveBalance" defaultValue={values.leaveBalance} min={0} />
          </Field>
        </div>
      </div>

      <h2 className="label-eyebrow px-4 pb-1 pt-1.5">{dict.team.contact}</h2>
      <div className="flex flex-col gap-2.5 px-4 pb-3.5">
        <div className="grid grid-cols-2 gap-2.5">
          <Field label={dict.team.phone}>
            <TextInput name="phone" type="tel" defaultValue={values.phone} />
          </Field>
          <Field label={dict.team.email}>
            <TextInput name="email" type="email" defaultValue={values.email} />
          </Field>
        </div>
        <Field label={dict.team.address}>
          <TextArea name="address" rows={2} defaultValue={values.address} />
        </Field>
      </div>

      <h2 className="label-eyebrow px-4 pb-1 pt-1.5">{dict.team.account}</h2>
      <div className="flex flex-col gap-1 px-4 pb-3.5">
        <Field label={dict.team.password}>
          <TextInput name="password" type="password" autoComplete="new-password" />
        </Field>
        <p className="text-xs text-muted">
          {mode === "create"
            ? dict.team.passwordNewHint
            : hasAccount
              ? dict.team.passwordEditHint
              : dict.team.passwordNoAccount}
        </p>
      </div>

      {error ? (
        <div className="px-4 pb-2">
          <FormError>{error}</FormError>
        </div>
      ) : null}

      <div className="flex gap-2 border-t-2 border-ink p-4">
        <Button type="submit" size="lg" fullWidth disabled={pending} className="justify-start">
          {pending ? dict.common.saving : saved ? `${dict.common.save} ✓` : dict.common.save}
        </Button>
        {onArchive ? (
          <Button variant="danger" size="lg" disabled={archiving} onClick={archive}>
            {dict.common.remove}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
