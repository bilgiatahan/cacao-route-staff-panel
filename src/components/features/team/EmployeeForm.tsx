"use client";

import { useActionState, useRef, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useActionFeedback } from "@/components/ui/use-action-feedback";
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
import { useFieldErrors } from "@/components/ui/use-field-errors";
import {
  actionErrorMessage,
  actionErrorMessages,
  type ActionResult,
} from "@/server/actions/action-result";
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const archiveFeedback = useActionFeedback(actionErrorMessages(dict));
  const archiving = archiveFeedback.pending;

  const formRef = useRef<HTMLFormElement>(null);
  const fields = useFieldErrors(formRef, state, (key) => actionErrorMessage(key, dict));
  const saved = state?.ok === true;

  // `window.confirm` was the only guard on the one irreversible action here, and
  // it could not say what archiving now actually does — it also removes the
  // person's sign-in. The dialog can.
  const confirmArchive = () => {
    if (!onArchive) return;
    setConfirmOpen(false);
    archiveFeedback.run(onArchive);
  };

  return (
    <>
      <form ref={formRef} action={formAction}>
      <h2 className="label-eyebrow px-4 pb-1 pt-3.5">{dict.team.personal}</h2>
      <div className="grid grid-cols-2 gap-2.5 px-4 pb-3">
        <Field
          label={dict.team.firstName}
          required
          error={fields.errorFor("firstName")}
          errorId={fields.errorId("firstName")}
        >
          <TextInput
            name="firstName"
            defaultValue={values.firstName}
            required
            {...fields.controlProps("firstName")}
          />
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
          <Field
          label={dict.team.email}
          error={fields.errorFor("email")}
          errorId={fields.errorId("email")}
        >
            <TextInput
              name="email"
              type="email"
              defaultValue={values.email}
              {...fields.controlProps("email")}
            />
          </Field>
        </div>
        <Field label={dict.team.address}>
          <TextArea name="address" rows={2} defaultValue={values.address} />
        </Field>
      </div>

      <h2 className="label-eyebrow px-4 pb-1 pt-1.5">{dict.team.account}</h2>
      <div className="flex flex-col gap-1 px-4 pb-3.5">
        {/* The hint moved inside the field, so an error replaces it in place
            instead of stacking two paragraphs under one control. */}
        <Field
          label={dict.team.password}
          error={fields.errorFor("password")}
          errorId={fields.errorId("password")}
          hint={
            mode === "create"
              ? dict.team.passwordNewHint
              : hasAccount
                ? dict.team.passwordEditHint
                : dict.team.passwordNoAccount
          }
        >
          <TextInput
            name="password"
            type="password"
            autoComplete="new-password"
            {...fields.controlProps("password")}
          />
        </Field>
      </div>

      {fields.formError ? (
        <div className="px-4 pb-2">
          <FormError>{fields.formError}</FormError>
        </div>
      ) : null}

      {archiveFeedback.error ? (
        <div className="px-4 pb-2">
          <Alert>{archiveFeedback.error}</Alert>
        </div>
      ) : null}

      <div className="flex gap-2 border-t-2 border-ink p-4">
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={pending}
          loadingLabel={dict.common.saving}
          className="justify-start"
        >
          {saved ? `${dict.common.save} ✓` : dict.common.save}
        </Button>
        {onArchive ? (
          <Button variant="danger" size="lg" loading={archiving} onClick={() => setConfirmOpen(true)}>
            {dict.common.remove}
          </Button>
        ) : null}
      </div>
      </form>

      {onArchive ? (
        <ConfirmDialog
          open={confirmOpen}
          pending={archiving}
          labels={{
            title: dict.team.removeTitle,
            body: dict.team.removeConfirm,
            confirm: dict.common.remove,
            cancel: dict.common.cancel,
            close: dict.common.close,
          }}
          onConfirm={confirmArchive}
          onCancel={() => setConfirmOpen(false)}
        />
      ) : null}
    </>
  );
}
