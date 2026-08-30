"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";

import type { PeriodPickerData } from "@/components/layout/period-options";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/utils";

export interface PeriodPickerProps extends PeriodPickerData {
  /** The period on screen, e.g. "3–9 Ağu" — the trigger's own text. */
  label: string;
}

/**
 * The middle of `PeriodSwitcher`: the period you are looking at, and a sheet that
 * jumps straight to another one.
 *
 * The arrows alone made distance cost taps — three weeks back was three round
 * trips through the server. This is the only part of the switcher that needs
 * the browser, so it is the only part that is a Client Component; the arrows
 * stay plain links and the rows inside the sheet are links too, which is why a
 * middle-click or a long-press still opens a period in a new tab.
 *
 * Weeks and months share it: nothing here knows which it is showing. Every
 * string arrives finished from `buildWeekPicker` / `buildMonthPicker` — no
 * dictionary crosses the boundary.
 */
export function PeriodPicker({ label, options, todayHref, labels }: PeriodPickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLAnchorElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const list = listRef.current;
    const row = selectedRef.current;
    if (!list || !row) return;

    // Centred by hand rather than with `scrollIntoView`, which would also scroll
    // the sheet's ancestors and drag the page out from under the scrim.
    list.scrollTop = row.offsetTop - list.clientHeight / 2 + row.clientHeight / 2;
  }, [open]);

  // Getting back to now is the one jump worth a dedicated target: it is the most
  // common one, and once you are more than six steps out it is the only period
  // the list below cannot reach. Hidden when you are already there, where it
  // would be a button that does nothing.
  const showTodayShortcut = !options.some((option) => option.current && option.selected);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${labels.open}: ${label}`}
        className="flex h-11 items-center gap-1 border-x border-line px-2.5 text-ink hover:bg-hover"
      >
        <span className="tabular whitespace-nowrap text-sm font-bold">{label}</span>
        <Icon name="chevronDown" className="h-3.5 w-3.5 text-muted" />
      </button>

      {open ? (
        <Sheet open onClose={close} title={labels.title} subtitle={label} closeLabel={labels.close}>
          {showTodayShortcut ? (
            <Link
              href={todayHref}
              onClick={close}
              className="mb-3 flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-brand px-3 text-sm font-bold text-white hover:bg-brand-dark"
            >
              <Icon name="calendarCheck" className="h-4 w-4" />
              {labels.today}
            </Link>
          ) : null}

          {/*
            `relative` so each row's `offsetTop` is measured against this box —
            the centring above depends on it.
          */}
          <div
            ref={listRef}
            className="relative -mx-4 max-h-[min(58vh,24rem)] overflow-y-auto overscroll-contain border-t-2 border-line"
          >
            {options.map((option) => (
              <Fragment key={option.href}>
                {option.groupHeading ? (
                  <div className="label-section sticky top-0 z-10 bg-fill px-4 py-1.5">
                    {option.groupHeading}
                  </div>
                ) : null}
                <Link
                  ref={option.selected ? selectedRef : undefined}
                  href={option.href}
                  onClick={close}
                  aria-current={option.selected ? "true" : undefined}
                  className={cn(
                    "flex min-h-12 items-center justify-between gap-2.5 border-b border-line px-4",
                    option.selected ? "bg-brand text-white" : "text-ink hover:bg-hover",
                  )}
                >
                  <span className="tabular text-base font-bold">{option.label}</span>
                  <span className="flex flex-none items-center gap-1.5">
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        option.selected
                          ? "text-white"
                          : option.current
                            ? "text-brand"
                            : "text-muted",
                      )}
                    >
                      {option.hint}
                    </span>
                    {/*
                      The fill says "selected" to anyone who can see it; the tick
                      says it to anyone who cannot resolve a green row from a
                      white one. Colour is never the only carrier.
                    */}
                    <Icon
                      name="check"
                      className={cn("h-4 w-4", option.selected ? "opacity-100" : "opacity-0")}
                    />
                  </span>
                </Link>
              </Fragment>
            ))}
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
