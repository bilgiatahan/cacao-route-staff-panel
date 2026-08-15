"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { NavIcon, type NavIconName } from "@/components/ui/NavIcon";
import { cn } from "@/lib/utils";

export interface NavItem {
  key: string;
  href: string;
  label: string;
  icon: NavIconName;
  badge: number;
}

/**
 * The five-tab bar. Switching tabs keeps the selected week, so the roster you
 * were looking at is still the one you land on.
 */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const week = searchParams.get("week");

  return (
    <nav className="sticky bottom-0 z-20 grid grid-cols-5 border-t-2 border-brand bg-brand rounded-t-[20px]">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const href = week ? `${item.href}?week=${week}` : item.href;

        return (
          <Link
            key={item.key}
            href={href}
            aria-current={active ? "page" : undefined}
            className="relative flex min-h-14 flex-col items-center justify-center gap-1 px-0.5 pb-2.5 pt-2"
          >
            <NavIcon name={item.icon} className={active ? "text-white" : "text-white/60"} />
            <span
              className={cn(
                "text-2xs font-bold uppercase tracking-[0.06em]",
                active ? "text-white" : "text-white/60",
              )}
            >
              {item.label}
            </span>
            {item.badge > 0 ? (
              <span className="tabular absolute right-[calc(50%-21px)] top-1 flex h-4 min-w-4 items-center justify-center bg-warn px-[3px] text-nano font-extrabold text-ink">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
