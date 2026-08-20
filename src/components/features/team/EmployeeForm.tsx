"use client";

import { useActionState, useRef, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useActionFeedback } from "@/components/ui/use-action-feedback";
import {
  Field,
  FieldLabel,
  FormError,
  SoftInput,
  SoftTextArea,
} from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { SectionHeading } from "@/components/ui/Section";
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

/**
 * The manager's editor for one person, migrated onto the Card family.
 *
 * It is the same form it was — same field names, same validation, same two
 * actions — wearing what `ProfileForm` wears: four `Card`s, each opened by a
 * `SectionHeading variant="card"`, soft controls on the radius ladder, and a
 * success `Alert` instead of a tick appended to the save button. That tick was
 * a real defect, not just an inconsistency: `Button` hides its children while
 * loading precisely so the width cannot change, and a label that grows by two
 * characters after a save defeats that.
 *
 * Fields stack on a phone and pair from `sm`, which is the measure
 * `ProfileForm` already settled: two 16px controls side by side on a 360px
 * screen leave neither of them readable.
 */
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
      <form ref={formRef} action={formAction} className="flex flex-col gap-3.5">
        <Card padding="md">
          <SectionHeading variant="card" icon="user" title={dict.team.personal} />
          <div className="grid grid-cols-1 gap-x-2.5 gap-y-3 sm:grid-cols-2">
            <Field
              label={dict.team.firstName}
              required
              error={fields.errorFor("firstName")}
              errorId={fields.errorId("firstName")}
            >
              <SoftInput
                name="firstName"
                autoComplete="given-name"
                defaultValue={values.firstName}
                required
                {...fields.controlProps("firstName")}
              />
            </Field>
            <Field label={dict.team.lastName}>
              <SoftInput
                name="lastName"
                autoComplete="family-name"
                defaultValue={values.lastName}
              />
            </Field>
            <Field label={dict.team.birth}>
              <SoftInput
                name="birthDate"
                type="date"
                icon="timetable"
                className="tabular"
                defaultValue={values.birthDate}
              />
            </Field>
            <Field label={dict.team.hired}>
              <SoftInput
                name="hiredAt"
                type="date"
                icon="timetable"
                className="tabular"
                defaultValue={values.hiredAt}
              />
            </Field>
          </div>
        </Card>

        <Card padding="md">
          <SectionHeading variant="card" icon="briefcase" title={dict.team.employment} />
          <div className="flex flex-col gap-3">
            <Field label={dict.team.position}>
              <SoftInput
                name="position"
                defaultValue={values.position}
                placeholder={dict.team.positionPlaceholder}
              />
            </Field>

            {/*
              A radio group in behaviour, so it says so — `aria-pressed` on a
              mutually exclusive pair announced two independent toggles. The
              submitted value is unchanged: the hidden input still carries it.
            */}
            <div className="flex flex-col gap-1">
              <FieldLabel>{dict.team.contract}</FieldLabel>
              <input type="hidden" name="contract" value={contract} />
              <div
                role="radiogroup"
                aria-label={dict.team.contract}
                className="flex overflow-hidden rounded-md border border-line"
              >
                {CONTRACTS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setContract(option)}
                    role="radio"
                    aria-checked={contract === option}
                    className={cn(
                      "min-h-11 flex-1 px-2 text-sm font-bold transition-colors",
                      "focus-visible:outline-offset-[-3px]",
                      contract === option
                        ? "bg-brand text-white"
                        : "bg-surface text-muted hover:bg-hover hover:text-ink",
                    )}
                  >
                    {dict.team.contracts[option]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-2.5 gap-y-3 sm:grid-cols-2">
              <Field label={dict.team.wage}>
                <SoftInput
                  name="hourlyRate"
                  type="number"
                  icon="pay"
                  className="tabular"
                  defaultValue={values.hourlyRate}
                  min={0}
                  step={5}
                />
              </Field>
              <Field label={dict.team.leaveBalance}>
                <SoftInput
                  name="leaveBalance"
                  type="number"
                  icon="hourglass"
                  className="tabular"
                  defaultValue={values.leaveBalance}
                  min={0}
                />
              </Field>
            </div>
          </div>
        </Card>

        <Card padding="md">
          <SectionHeading variant="card" icon="mail" title={dict.team.contact} />
          <div className="grid grid-cols-1 gap-x-2.5 gap-y-3 sm:grid-cols-2">
            <Field label={dict.team.phone}>
              <SoftInput
                name="phone"
                type="tel"
                icon="phone"
                autoComplete="tel"
                defaultValue={values.phone}
              />
            </Field>
            <Field
              label={dict.team.email}
              error={fields.errorFor("email")}
              errorId={fields.errorId("email")}
            >
              <SoftInput
                name="email"
                type="email"
                icon="mail"
                defaultValue={values.email}
                {...fields.controlProps("email")}
              />
            </Field>
            <Field label={dict.team.address} className="sm:col-span-2">
              <SoftTextArea name="address" rows={2} defaultValue={values.address} />
            </Field>
          </div>
        </Card>

        <Card padding="md">
          <SectionHeading variant="card" icon="lock" title={dict.team.account} />
          {/* The hint lives inside the field, so an error replaces it in place
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
            <SoftInput
              name="password"
              type="password"
              icon="lock"
              autoComplete="new-password"
              {...fields.controlProps("password")}
            />
          </Field>
        </Card>

        {fields.formError ? <FormError>{fields.formError}</FormError> : null}
        {archiveFeedback.error ? <Alert>{archiveFeedback.error}</Alert> : null}
        {saved && !fields.formError ? (
          <Alert tone="success">{dict.team.saved}</Alert>
        ) : null}

        <div className="flex gap-2">
          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={pending}
            loadingLabel={dict.common.saving}
            className="gap-2"
          >
            <Icon name="save" className="h-4 w-4" />
            {dict.common.save}
          </Button>
          {onArchive ? (
            <Button
              variant="danger"
              size="lg"
              loading={archiving}
              loadingLabel={dict.common.remove}
              onClick={() => setConfirmOpen(true)}
            >
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
