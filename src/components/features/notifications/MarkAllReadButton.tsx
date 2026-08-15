"use client";

import { useTransition } from "react";

import { markAllNotificationsReadAction } from "@/server/actions/notification.actions";

export function MarkAllReadButton({ label, disabled }: { label: string; disabled: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() => startTransition(async () => void (await markAllNotificationsReadAction()))}
      className="py-1 text-xs font-bold text-brand hover:text-brand-dark disabled:text-muted-soft"
    >
      {label}
    </button>
  );
}
