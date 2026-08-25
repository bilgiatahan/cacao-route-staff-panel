"use client";

import { useActionState, useRef } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, SoftInput } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Hint, SectionHeading } from "@/components/ui/Section";
import { Toast } from "@/components/ui/Toast";
import { useSubmitCount } from "@/components/ui/use-submit-count";
import { DEFAULT_FIELD_MAP } from "@/lib/forms/field-errors";
import { PASSWORD_RULE } from "@/lib/forms/rules";
import type { Dictionary } from "@/lib/i18n";
import { useFieldErrors } from "@/components/ui/use-field-errors";
import { actionErrorMessage, type ActionResult } from "@/server/actions/action-result";

export interface PasswordFormProps {
  dict: Dictionary;
  action: (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;
}

/**
 * Changing your own password — its own card, its own submit, its own action.
 *
 * It was a second card inside the profile form, sharing one button. That made
 * two unrelated failures interchangeable: a mistyped current password rolled
 * back a phone number that was perfectly fine, and saving a new address asked
 * for a password nobody wanted to change. Separating the submit separates the
 * consequences.
 *
 * All three fields are required *here* but not on the profile form, which is the
 * point: this form is only submitted by someone who came to change a password,
 * so the browser can insist on all three before a round trip.
 *
 * The confirmation field is checked on the server rather than in the browser.
 * That is deliberate — `changePasswordAction` has to check it anyway (a plain
 * POST reaches it directly), and a client-side match check would be a second
 * copy of the same rule. The cost is one round trip on a typo; the saving is one
 * rule instead of two that can disagree.
 */
export function PasswordForm({ dict, action }: PasswordFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    action,
    null,
  );

  const formRef = useRef<HTMLFormElement>(null);
  const fields = useFieldErrors(formRef, state, (key) => actionErrorMessage(key, dict), {
    ...DEFAULT_FIELD_MAP,
    // This form's box is `newPassword`; the shared map points at `password`,
    // which is `EmployeeForm`'s name for it.
    passwordTooShort: "newPassword",
    passwordTooLong: "newPassword",
  });
  const changed = state?.ok === true;
  const attempt = useSubmitCount(pending);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3.5">
      <Card padding="md">
        <SectionHeading variant="card" icon="lock" title={dict.profile.changePassword} />

        <div className="grid grid-cols-1 gap-x-2.5 gap-y-3 sm:grid-cols-2">
          <Field
            label={dict.profile.currentPassword}
            required
            className="sm:col-span-2"
            error={fields.errorFor("currentPassword")}
            errorId={fields.errorId("currentPassword")}
          >
            <SoftInput
              name="currentPassword"
              type="password"
              icon="lock"
              autoComplete="current-password"
              required
              {...fields.controlProps("currentPassword")}
            />
          </Field>

          <Field
            label={dict.profile.newPassword}
            required
            error={fields.errorFor("newPassword")}
            errorId={fields.errorId("newPassword")}
          >
            <SoftInput
              name="newPassword"
              type="password"
              icon="lock"
              autoComplete="new-password"
              required
              minLength={PASSWORD_RULE.minLength}
              maxLength={PASSWORD_RULE.maxLength}
              {...fields.controlProps("newPassword")}
            />
          </Field>
          <Field
            label={dict.profile.confirmPassword}
            required
            error={fields.errorFor("confirmPassword")}
            errorId={fields.errorId("confirmPassword")}
          >
            <SoftInput
              name="confirmPassword"
              type="password"
              icon="lock"
              autoComplete="new-password"
              required
              minLength={PASSWORD_RULE.minLength}
              maxLength={PASSWORD_RULE.maxLength}
              {...fields.controlProps("confirmPassword")}
            />
          </Field>
        </div>

        <Hint icon="info" className="pt-2.5">
          {dict.profile.passwordSectionHint}
        </Hint>
      </Card>

      <Toast
        message={fields.formError}
        nonce={attempt}
        tone="danger"
        closeLabel={dict.common.close}
      />
      <Toast
        message={changed && !fields.formError ? dict.profile.passwordSaved : null}
        nonce={attempt}
        tone="success"
        closeLabel={dict.common.close}
      />

      {/*
        Secondary next to the profile card's primary save: on a page with two
        submits, both looking equally like "the button" is how someone presses
        the wrong one.
      */}
      <Button
        type="submit"
        variant="outline"
        size="lg"
        fullWidth
        loading={pending}
        loadingLabel={dict.common.saving}
        className="gap-2"
      >
        <Icon name="lock" className="h-4 w-4" />
        {dict.profile.updatePassword}
      </Button>
    </form>
  );
}
