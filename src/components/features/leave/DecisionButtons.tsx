"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/Button";
import type { ActionResult } from "@/server/actions/action-result";

export interface DecisionButtonsProps {
  approveLabel: string;
  rejectLabel: string;
  onDecide: (decision: "approved" | "rejected") => Promise<ActionResult>;
}

/** Approve / decline pair shared by the leave and swap lists. */
export function DecisionButtons({ approveLabel, rejectLabel, onDecide }: DecisionButtonsProps) {
  const [pending, startTransition] = useTransition();

  const decide = (decision: "approved" | "rejected") => {
    startTransition(async () => {
      await onDecide(decision);
    });
  };

  return (
    <div className="mt-2.5 flex gap-2">
      <Button
        fullWidth
        disabled={pending}
        onClick={() => decide("approved")}
        className="justify-start"
      >
        {approveLabel}
      </Button>
      <Button
        variant="outline"
        fullWidth
        disabled={pending}
        onClick={() => decide("rejected")}
        className="justify-start"
      >
        {rejectLabel}
      </Button>
    </div>
  );
}
