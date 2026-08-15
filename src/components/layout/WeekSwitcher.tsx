"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { addIsoDays } from "@/lib/date";
import { resolveWeekStart } from "@/lib/week-params";

export interface WeekSwitcherProps {
  /** Pre-rendered labels, so the client never needs the dictionary. */
  previousLabel: string;
  nextLabel: string;
  /** Server-formatted label for the week currently in the URL. */
  fallbackLabel: string;
  /** Month names for re-labelling after a client-side navigation. */
  monthNames: string[];
}

function labelFor(weekStart: string, monthNames: string[]): string {
  const [startYear, startMonth, startDay] = weekStart.split("-").map(Number);
  const start = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.getDate()}–${end.getDate()} ${monthNames[end.getMonth()]}`;
}

/**
 * Week navigation lives in the URL, so the roster stays server-rendered and a
 * given week can be linked to or bookmarked.
 */
export function WeekSwitcher({
  previousLabel,
  nextLabel,
  fallbackLabel,
  monthNames,
}: WeekSwitcherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const weekStart = resolveWeekStart(searchParams.get("week") ?? undefined);

  const hrefFor = (offsetWeeks: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("week", addIsoDays(weekStart, offsetWeeks * 7));
    return `${pathname}?${params.toString()}`;
  };

  const label = searchParams.get("week") ? labelFor(weekStart, monthNames) : fallbackLabel;

  return (
    <div className="flex flex-none items-center border border-line-strong">
      <Link
        href={hrefFor(-1)}
        aria-label={previousLabel}
        className="px-2.5 py-1 text-base font-bold text-ink hover:bg-hover"
      >
        ‹
      </Link>
      <span className="tabular whitespace-nowrap border-x border-line px-2 text-xs font-bold tracking-[0.04em]">
        {label}
      </span>
      <Link
        href={hrefFor(1)}
        aria-label={nextLabel}
        className="px-2.5 py-1 text-base font-bold text-ink hover:bg-hover"
      >
        ›
      </Link>
    </div>
  );
}
