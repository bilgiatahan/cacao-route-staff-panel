"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, FormError, TextInput } from "@/components/ui/Field";
import { actionErrorMessage, type ActionResult } from "@/server/actions/action-result";
import { signInAction } from "@/server/actions/auth.actions";
import type { Dictionary } from "@/lib/i18n";

export interface LoginFormProps {
  dict: Dictionary;
  callbackUrl: string;
  defaultEmail: string;
}

export function LoginForm({ dict, callbackUrl, defaultEmail }: LoginFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    signInAction,
    null,
  );

  // Deliberately form-level: the server does not say whether the address or the
  // password was wrong, and pinning it to either would invent information it
  // withheld on purpose.
  const error = state && !state.ok ? actionErrorMessage(state.error, dict) : null;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <Field label={dict.auth.email} required>
        <TextInput
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={defaultEmail}
        />
      </Field>

      <Field label={dict.auth.password} required>
        <TextInput name="password" type="password" autoComplete="current-password" required />
      </Field>

      {error ? <FormError>{error}</FormError> : null}

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={pending}
        loadingLabel={dict.auth.submitting}
        className="mt-1"
      >
        {dict.auth.submit}
      </Button>
    </form>
  );
}
