"use client";

import { useTransition } from "react";

import { cn } from "@/lib/utils";
import { markNotificationReadAction } from "@/server/actions/notification.actions";

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
}

export function NotificationList({ items, emptyLabel }: NotificationListProps) {
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return <p className="px-4 py-4.5 text-sm text-muted-soft">{emptyLabel}</p>;
  }

  return (
    <ul>
      {items.map((item) => {
        const markRead = () => {
          if (item.read) return;
          startTransition(async () => {
            await markNotificationReadAction(item.id);
          });
        };

        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={markRead}
              disabled={item.read || pending}
              className={cn(
                "flex w-full gap-3 px-4 py-3 text-left",
                item.read ? "bg-surface" : "bg-surface-tint",
                !item.read && "cursor-pointer hover:bg-brand-faint",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-1.5 size-2 flex-none",
                  item.read ? "bg-[#dcdada]" : "bg-brand",
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
              <span className="flex-none text-2xs text-muted-soft">{item.when}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
