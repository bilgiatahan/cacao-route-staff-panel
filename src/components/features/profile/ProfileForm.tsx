"use client";

import { useActionState, useRef } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, SoftInput, SoftTextArea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { SectionHeading } from "@/components/ui/Section";
import { Toast } from "@/components/ui/Toast";
import { useSubmitCount } from "@/components/ui/use-submit-count";
import type { Dictionary } from "@/lib/i18n";
import { useFieldErrors } from "@/components/ui/use-field-errors";
import { DEFAULT_FIELD_MAP } from "@/lib/forms/field-errors";
import { birthDateBounds, inputProps, PERSON_RULES } from "@/lib/forms/rules";
import { actionErrorMessage, type ActionResult } from "@/server/actions/action-result";

export interface ProfileFormValues {
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  email: string;
  address: string;
}

export interface ProfileFormProps {
  dict: Dictionary;
  values: ProfileFormValues;
  action: (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;
}

/**
 * The signed-in person editing their own contact details.
 *
 * Pay and contract are not here on purpose — they belong to the manager's
 * `EmployeeForm`. Neither is the password: that is `PasswordForm`, a separate
 * card with its own submit, because changing where you live and changing a
 * secret are different decisions and one should not be able to roll back the
 * other.
 *
 * Validation is native. Every constraint on these controls comes from
 * `PERSON_RULES`, and `updateProfileAction` checks the same object — so the
 * browser can refuse a bad value before a round trip, the server refuses it
 * again because a Server Function is reachable by a plain POST, and neither can
 * drift from the other. The invalid *styling* is driven by `aria-invalid`, which
 * `CONTROL_CLASS_SOFT` already wires, so the look and the announcement cannot
 * disagree either.
 */
export function ProfileForm({ dict, values, action }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    action,
    null,
  );

  const formRef = useRef<HTMLFormElement>(null);
  const fields = useFieldErrors(formRef, state, (key) => actionErrorMessage(key, dict), {
    ...DEFAULT_FIELD_MAP,
    // This form has no password box, so a password key here would point at a
    // control that is not on the page.
    passwordTooShort: null,
    passwordTooLong: null,
    accountNeedsEmail: null,
  });
  const saved = state?.ok === true;
  // Two saves in a row carry the same sentence, so the toast needs to be told
  // they are two events rather than one still on screen.
  const attempt = useSubmitCount(pending);

  // Read at render rather than module load: a tab left open overnight would
  // otherwise keep yesterday's bounds. The action re-derives them anyway.
  const birth = birthDateBounds();

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3.5">
      <Card padding="md">
        <SectionHeading variant="card" icon="user" title={dict.profile.personal} />

        {/* One column on a phone: two 16px fields side by side on a 360px
            screen left neither of them readable. Two from `sm` up, where
            scanning a pair actually helps. */}
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
              {...inputProps(PERSON_RULES.firstName)}
              {...fields.controlProps("firstName")}
            />
          </Field>
          <Field label={dict.team.lastName}>
            <SoftInput
              name="lastName"
              autoComplete="family-name"
              defaultValue={values.lastName}
              {...inputProps(PERSON_RULES.lastName)}
            />
          </Field>

          <Field
            label={dict.team.birth}
            className="sm:col-span-2"
            error={fields.errorFor("birthDate")}
            errorId={fields.errorId("birthDate")}
          >
            <SoftInput
              name="birthDate"
              type="date"
              icon="timetable"
              className="tabular"
              defaultValue={values.birthDate}
              // The picker itself refuses an implausible year, so the typo the
              // action guards against mostly never gets typed.
              min={birth.min}
              max={birth.max}
              {...fields.controlProps("birthDate")}
            />
          </Field>

          <Field
            label={dict.team.phone}
            error={fields.errorFor("phone")}
            errorId={fields.errorId("phone")}
          >
            {/* `+44` is fixed chrome; the box holds the national part and
                masks it as it is typed. The grouping comes from the same module
                the action validates with. */}
            <PhoneInput
              name="phone"
              icon="phone"
              defaultValue={values.phone}
              {...fields.controlProps("phone")}
            />
          </Field>
          <Field
            label={dict.team.email}
            required
            error={fields.errorFor("email")}
            errorId={fields.errorId("email")}
          >
            <SoftInput
              name="email"
              type="email"
              icon="mail"
              autoComplete="email"
              inputMode="email"
              defaultValue={values.email}
              {...inputProps(PERSON_RULES.email)}
              {...fields.controlProps("email")}
            />
          </Field>

          <Field label={dict.team.address} className="sm:col-span-2">
            <SoftTextArea
              name="address"
              rows={2}
              defaultValue={values.address}
              maxLength={PERSON_RULES.address.maxLength}
            />
          </Field>
        </div>
      </Card>

      {/* Outcome, not instruction: the field-level errors stay on their fields,
          and this reports how the save itself went. */}
      <Toast
        message={fields.formError}
        nonce={attempt}
        tone="danger"
        closeLabel={dict.common.close}
      />
      <Toast
        message={saved && !fields.formError ? dict.profile.saved : null}
        nonce={attempt}
        tone="success"
        closeLabel={dict.common.close}
      />

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={pending}
        loadingLabel={dict.common.saving}
        className="gap-2"
      >
        <Icon name="save" className="h-4 w-4" />
        {dict.profile.saveChanges}
      </Button>
    </form>
  );
}
