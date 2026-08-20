"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
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
  /** The word itself — "unread" — so the state is text, not a coloured dot. */
  unreadLabel: string;
  errorMessages: Record<ActionErrorKey, string>;
}

/**
 * Marking one notification read must not freeze the others.
 *
 * The hook exposes a single `pending` for the whole list, so wiring it straight
 * to every row disabled all of them for the duration of one request. The id of
 * the row in flight is tracked instead — the same per-item pattern
 * `DecisionButtons` uses to spin only the button that was pressed.
 *
 * Migrated off the Ruled family: rows were edge-to-edge under a 2px rule, and
 * unread was carried by a 8px square dot, a background tint and a font weight —
 * two of those three being colour. Each row is a `Card` now, and unread says so
 * in a `Badge`. The `Card` stays unpadded so the button can fill it: the whole
 * row is the target, which is what the hit area was already trying to be.
 */
export function NotificationList({
  items,
  emptyLabel,
  unreadLabel,
  errorMessages,
}: NotificationListProps) {
  const { run, pending, error } = useActionFeedback(errorMessages);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState icon="notifications">{emptyLabel}</EmptyState>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
        const busy = pending && busyId === item.id;

        const markRead = () => {
          if (item.read) return;
          setBusyId(item.id);
          run(() => markNotificationReadAction(item.id));
        };

        return (
          <li key={item.id}>
            <Card className={cn("overflow-hidden", !item.read && "border-brand/30")}>
              <button
                type="button"
                onClick={markRead}
                // Only this row waits; the rest of the list stays usable.
                disabled={item.read || busy}
                aria-busy={busy || undefined}
                className={cn(
                  "flex w-full gap-2.5 p-3 text-left lg:p-3.5",
                  item.read ? "bg-surface" : "bg-brand-faint",
                  !item.read && "cursor-pointer hover:bg-brand-soft",
                  busy && "opacity-60",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={cn(
                        "text-md",
                        item.read ? "font-medium text-ink" : "font-bold text-brand-dark",
                      )}
                    >
                      {item.title}
                    </span>
                    {item.read ? null : <Badge tone="info">{unreadLabel}</Badge>}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">{item.body}</span>
                </span>
                {/* Secondary by size and weight, not by being tucked away. */}
                <span className="flex-none text-2xs text-muted">{item.when}</span>
              </button>
            </Card>
          </li>
        );
      })}
      {error ? (
        <li>
          <Alert>{error}</Alert>
        </li>
      ) : null}
    </ul>
  );
}
