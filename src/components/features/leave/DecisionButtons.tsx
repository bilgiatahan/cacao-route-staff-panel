"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { useActionFeedback } from "@/components/ui/use-action-feedback";
import type { ActionErrorKey, ActionResult } from "@/server/actions/action-result";

export interface DecisionButtonsProps {
  approveLabel: string;
  rejectLabel: string;
  /** Pre-resolved messages, so the dictionary stays on the server. */
  errorMessages: Record<ActionErrorKey, string>;
  onDecide: (decision: "approved" | "rejected") => Promise<ActionResult>;
}

/**
 * Approve / decline pair shared by the leave and swap lists.
 *
 * The result used to be discarded, so losing a race with another admin — the
 * request was already decided, or the shift had moved — looked exactly like
 * success. Now the failure is stated in the row it belongs to.
 */
export function DecisionButtons({
  approveLabel,
  rejectLabel,
  errorMessages,
  onDecide,
}: DecisionButtonsProps) {
  const { run, pending, error } = useActionFeedback(errorMessages);
  // Which button was pressed, so only that one spins.
  const [active, setActive] = useState<"approved" | "rejected" | null>(null);

  const decide = (decision: "approved" | "rejected") => {
    setActive(decision);
    run(() => onDecide(decision));
  };

  return (
    <>
      <div className="mt-2.5 flex gap-2">
        <Button
          fullWidth
          disabled={pending}
          loading={pending && active === "approved"}
          onClick={() => decide("approved")}
          className="justify-start"
        >
          {approveLabel}
        </Button>
        <Button
          variant="outline"
          fullWidth
          disabled={pending}
          loading={pending && active === "rejected"}
          onClick={() => decide("rejected")}
          className="justify-start"
        >
          {rejectLabel}
        </Button>
      </div>
      {error ? <Alert className="mt-2">{error}</Alert> : null}
    </>
  );
}
