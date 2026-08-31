"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { SectionHeading } from "@/components/ui/Section";
import { Switch } from "@/components/ui/Switch";
import { Toast } from "@/components/ui/Toast";
import { useSubmitCount } from "@/components/ui/use-submit-count";
import type { ActionErrorKey, ActionResult } from "@/server/actions/action-result";

export interface SettingsFormLabels {
  section: string;
  staffCanSeePay: string;
  staffCanSeePayHint: string;
  on: string;
  off: string;
  save: string;
  saving: string;
  saved: string;
  close: string;
}

export interface SettingsFormProps {
  /** The stored value; the form is the switch's only source of truth after that. */
  staffCanSeePay: boolean;
  labels: SettingsFormLabels;
  /** Key → sentence, resolved on the server so the dictionary stays there. */
  messages: Record<ActionErrorKey, string>;
  action: (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;
}

/**
 * The settings screen's one card.
 *
 * Finished strings, not the dictionary: this is a client component, and the
 * canonical rule in `CLAUDE.md` is that the dictionary never crosses the
 * boundary. `messages` is the pre-resolved error map from `actionErrorMessages`
 * for the same reason.
 *
 * An explicit Save rather than saving the moment the switch moves. The switch
 * changes what every member of staff can see, so it is worth one deliberate
 * confirmation — and a save-on-toggle would leave a mis-tap already written,
 * with nothing on screen saying it had been.
 */
export function SettingsForm({
  staffCanSeePay,
  labels,
  messages,
  action,
}: SettingsFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    action,
    null,
  );

  const error = state && !state.ok ? (messages[state.error] ?? messages.unexpected) : null;
  // Two saves in a row carry the same sentence, so the toast has to be told they
  // are two events rather than one still on screen.
  const attempt = useSubmitCount(pending);

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <Card padding="md">
        <SectionHeading variant="card" icon="shield" title={labels.section} />
        <Switch
          name="staffCanSeePay"
          label={labels.staffCanSeePay}
          description={labels.staffCanSeePayHint}
          stateLabels={{ on: labels.on, off: labels.off }}
          defaultChecked={staffCanSeePay}
        />
      </Card>

      <Toast message={error} nonce={attempt} tone="danger" closeLabel={labels.close} />
      <Toast
        message={state?.ok ? labels.saved : null}
        nonce={attempt}
        tone="success"
        closeLabel={labels.close}
      />

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={pending}
        loadingLabel={labels.saving}
        className="gap-2"
      >
        <Icon name="save" className="h-4 w-4" />
        {labels.save}
      </Button>
    </form>
  );
}
