"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, FormError, SoftInput, SoftTextArea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { SectionHeading } from "@/components/ui/Section";
import type { Dictionary } from "@/lib/i18n";
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
 * The signed-in person editing their own record — card family: each block is a
 * surface on the page's tint, so the form reads as the same object as the work
 * details card sitting under it. Pay and contract are not here on purpose; they
 * stay on the manager's `EmployeeForm`.
 */
export function ProfileForm({ dict, values, action }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    action,
    null,
  );

  const error = state && !state.ok ? actionErrorMessage(state.error, dict) : null;
  const saved = state?.ok === true;

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <Card className="px-3.5 pb-3.5 pt-3">
        <SectionHeading variant="card" icon="user" title={dict.profile.personal} />

        <div className="grid grid-cols-2 gap-x-2.5 gap-y-3">
          <Field label={dict.team.firstName}>
            <SoftInput
              name="firstName"
              autoComplete="given-name"
              defaultValue={values.firstName}
              required
            />
          </Field>
          <Field label={dict.team.lastName}>
            <SoftInput
              name="lastName"
              autoComplete="family-name"
              defaultValue={values.lastName}
            />
          </Field>

          <Field label={dict.team.birth} className="col-span-2">
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
          <Field label={dict.team.email}>
            <SoftInput
              name="email"
              type="email"
              icon="mail"
              autoComplete="email"
              defaultValue={values.email}
              required
            />
          </Field>

          <Field label={dict.team.address} className="col-span-2">
            <SoftTextArea name="address" rows={2} defaultValue={values.address} />
          </Field>
        </div>
      </Card>

      <Card className="px-3.5 pb-3.5 pt-3">
        <SectionHeading variant="card" icon="lock" title={dict.profile.changePassword} />

        <div className="grid grid-cols-2 gap-2.5">
          <Field label={dict.profile.currentPassword}>
            <SoftInput
              name="currentPassword"
              type="password"
              icon="lock"
              autoComplete="current-password"
              placeholder={dict.profile.currentPasswordPlaceholder}
            />
          </Field>
          <Field label={dict.profile.newPassword}>
            <SoftInput
              name="newPassword"
              type="password"
              icon="lock"
              autoComplete="new-password"
              placeholder={dict.profile.newPasswordPlaceholder}
            />
          </Field>
        </div>
        <p className="pt-2.5 text-xs text-muted">{dict.profile.passwordHint}</p>
      </Card>

      {error ? <FormError>{error}</FormError> : null}
      {saved && !error ? (
        <p
          role="status"
          className="rounded-md bg-accent-green-soft px-2.5 py-2 text-xs font-semibold text-accent-green"
        >
          {dict.profile.saved}
        </p>
      ) : null}

      <Button type="submit" size="lg" fullWidth disabled={pending} className="rounded-md gap-2">
        <Icon name="save" className="h-4 w-4" />
        {pending ? dict.common.saving : dict.profile.saveChanges}
      </Button>
    </form>
  );
}
