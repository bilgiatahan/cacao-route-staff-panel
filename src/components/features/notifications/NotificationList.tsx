"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/Section";
import { useActionFeedback } from "@/components/ui/use-action-feedback";
import { cn } from "@/lib/utils";
import { markNotificationReadAction } from "@/server/actions/notification.actions";
import type { ActionErrorKey } from "@/server/actions/action-result";

export interface NotificationItemView {
  id: string;
  title: string;
  body: string;
  when: string;
  read: boolean;
}

export interface NotificationListProps {
  items: NotificationItemView[];
  emptyLabel: string;
  errorMessages: Record<ActionErrorKey, string>;
}

/**
 * Marking one notification read must not freeze the others.
 *
 * The hook exposes a single `pending` for the whole list, so wiring it straight
 * to every row disabled all of them for the duration of one request. The id of
 * the row in flight is tracked instead — the same per-item pattern
 * `DecisionButtons` uses to spin only the button that was pressed.
 */
export function NotificationList({ items, emptyLabel, errorMessages }: NotificationListProps) {
  const { run, pending, error } = useActionFeedback(errorMessages);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (items.length === 0) {
    return <EmptyState>{emptyLabel}</EmptyState>;
  }

  return (
    <ul>
      {items.map((item) => {
        const busy = pending && busyId === item.id;

        const markRead = () => {
          if (item.read) return;
          setBusyId(item.id);
          run(() => markNotificationReadAction(item.id));
        };

        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={markRead}
              // Only this row waits; the rest of the list stays usable.
              disabled={item.read || busy}
              aria-busy={busy || undefined}
              className={cn(
                "flex w-full gap-3 px-4 py-3 text-left",
                item.read ? "bg-surface" : "bg-surface-tint",
                !item.read && "cursor-pointer hover:bg-brand-faint",
                busy && "opacity-60",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-1.5 size-2 flex-none",
                  item.read ? "bg-line-strong" : "bg-brand",
                )}
              />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-base",
                    item.read ? "font-medium" : "font-bold",
                  )}
                >
                  {item.title}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{item.body}</span>
              </span>
              <span className="flex-none text-2xs text-muted">{item.when}</span>
            </button>
          </li>
        );
      })}
      {error ? (
        <li className="px-4 py-2.5">
          <Alert>{error}</Alert>
        </li>
      ) : null}
    </ul>
  );
}
