"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { CountBadge } from "@/components/ui/Badge";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

export interface NavItem {
  key: string;
  href: string;
  label: string;
  icon: IconName;
  badge: number;
  /** Completes the badge's accessible sentence, e.g. "2 pending". */
  badgeLabel?: string;
}

/**
 * The four primary destinations. Switching tabs keeps the selected week, so the
 * roster you were looking at is still the one you land on.
 *
 * Order is fixed by the information architecture, not by the caller: summary,
 * schedule, leave, payroll. The grid tracks the item count rather than being
 * hard-coded to four, so a mistake in the item list cannot silently produce a
 * broken row.
 */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const week = searchParams.get("week");

  return (
    <nav
      // `pb-[env(safe-area-inset-bottom)]` keeps the labels clear of the iOS
      // home indicator, which used to sit on top of them.
      className="sticky bottom-0 z-10 rounded-t-xl border-t-2 border-brand bg-brand pb-[env(safe-area-inset-bottom)]"
    >
      <div
        className="mx-auto grid max-w-panel"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          // Nested routes count as their section: /team/emp-3 keeps Payroll lit.
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const href = week ? `${item.href}?week=${week}` : item.href;

          return (
            <Link
              key={item.key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-1 px-0.5 pb-2.5 pt-3",
                "focus-visible:outline-offset-[-3px]",
              )}
            >
              <Icon
                name={item.icon}
                className={active ? "text-white" : "text-white/75"}
              />
              <span
                className={cn(
                  "text-2xs uppercase tracking-[0.06em]",
                  active ? "font-extrabold text-white" : "font-bold text-white/75",
                )}
              >
                {item.label}
              </span>
              <CountBadge
                count={item.badge}
                label={item.badgeLabel ?? ""}
                className="absolute right-[calc(50%-22px)] top-1.5"
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
