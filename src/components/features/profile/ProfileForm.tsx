"use client";

import { useActionState, useRef } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, FormError, SoftInput, SoftTextArea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Hint, SectionHeading } from "@/components/ui/Section";
import type { Dictionary } from "@/lib/i18n";
import { useFieldErrors } from "@/components/ui/use-field-errors";
import { DEFAULT_FIELD_MAP } from "@/lib/forms/field-errors";
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
 * The signed-in person editing their own record.
 *
 * Two cards, because they are two different decisions: contact details you
 * change whenever they change, and a password you change rarely and carefully.
 * They stay on one page and inside one submit so it never feels like a second,
 * unrelated screen. Pay and contract are not here on purpose — they belong to
 * the manager's `EmployeeForm`.
 */
export function ProfileForm({ dict, values, action }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    action,
    null,
  );

  const formRef = useRef<HTMLFormElement>(null);
  const fields = useFieldErrors(
    formRef,
    state,
    (key) => actionErrorMessage(key, dict),
    {
      ...DEFAULT_FIELD_MAP,
      // This form's password box is `newPassword`.
      passwordTooShort: "newPassword",
      // Here it means the person has no sign-in at all — not a bad address.
      accountNeedsEmail: null,
    },
  );
  const saved = state?.ok === true;

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

          <Field label={dict.team.birth} className="sm:col-span-2">
            <SoftInput
              name="birthDate"
              type="date"
              icon="timetable"
              className="tabular"
              defaultValue={values.birthDate}
            />
          </Field>

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
            required
            error={fields.errorFor("email")}
            errorId={fields.errorId("email")}
          >
            <SoftInput
              name="email"
              type="email"
              icon="mail"
              autoComplete="email"
              defaultValue={values.email}
              required
              {...fields.controlProps("email")}
            />
          </Field>

          <Field label={dict.team.address} className="sm:col-span-2">
            <SoftTextArea name="address" rows={2} defaultValue={values.address} />
          </Field>
        </div>
      </Card>

      <Card padding="md">
        <SectionHeading variant="card" icon="lock" title={dict.profile.changePassword} />

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {/* Placeholders here only restated the labels, so they are gone. */}
          <Field
            label={dict.profile.currentPassword}
            error={fields.errorFor("currentPassword")}
            errorId={fields.errorId("currentPassword")}
          >
            <SoftInput
              name="currentPassword"
              type="password"
              icon="lock"
              autoComplete="current-password"
              {...fields.controlProps("currentPassword")}
            />
          </Field>
          <Field
            label={dict.profile.newPassword}
            error={fields.errorFor("newPassword")}
            errorId={fields.errorId("newPassword")}
          >
            <SoftInput
              name="newPassword"
              type="password"
              icon="lock"
              autoComplete="new-password"
              {...fields.controlProps("newPassword")}
            />
          </Field>
        </div>
        <Hint className="pt-2.5">{dict.profile.passwordHint}</Hint>
      </Card>

      {fields.formError ? <FormError>{fields.formError}</FormError> : null}
      {saved && !fields.formError ? (
        <Alert tone="success">{dict.profile.saved}</Alert>
      ) : null}

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
