import Link from "next/link";

import { PeriodPicker } from "@/components/layout/PeriodPicker";
import type { PeriodPickerData } from "@/components/layout/period-options";
import { Icon } from "@/components/ui/Icon";

export interface PeriodSwitcherProps {
  /** Pre-built by the page with `panelHref`, so the rest of the URL survives. */
  previousHref: string;
  nextHref: string;
  /** Server-formatted period, e.g. "3–9 Aug" or "Aug 2026". */
  label: string;
  previousLabel: string;
  nextLabel: string;
  /** Names the control as a whole for assistive tech. */
  ariaLabel: string;
  /** Rows, shortcut and strings for the label's picker — `buildWeekPicker` /
   *  `buildMonthPicker`. */
  picker: PeriodPickerData;
}

/**
 * Previous / current / next period — the arrows as links, the label as a picker.
 *
 * One control for both units. A week switcher and a month switcher differ only
 * in the strings the page hands them, so they are the same component: writing
 * the second one would have meant two 60-line files that look identical until
 * someone fixes a focus bug in one of them.
 *
 * It was briefly a Client Component that read `useSearchParams` and re-derived
 * its own label — necessary when it lived in the panel layout, which cannot see
 * search params. Mounted in the page instead, none of that is needed: the page
 * already knows its state, so it builds every href with `panelHref` and formats
 * every label with `lib/format`. No second copy of the date maths, and the whole
 * thing stays linkable.
 *
 * The label is a button that opens `PeriodPicker`, because stepping was once the
 * *only* way to move and distance cost a round trip per step. That picker is the
 * one piece that needs the browser, so it is the one piece that ships as a
 * Client Component; this stays a Server Component and the arrows stay links.
 */
export function PeriodSwitcher({
  previousHref,
  nextHref,
  label,
  previousLabel,
  nextLabel,
  ariaLabel,
  picker,
}: PeriodSwitcherProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className="flex flex-none items-center rounded-md border border-line bg-surface"
    >
      <Link
        href={previousHref}
        aria-label={previousLabel}
        className="flex size-11 flex-none items-center justify-center rounded-md text-ink hover:bg-hover"
      >
        <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
      </Link>
      {/* The period is the control's current value, and the way to change it. */}
      <PeriodPicker label={label} {...picker} />
      <Link
        href={nextHref}
        aria-label={nextLabel}
        className="flex size-11 flex-none items-center justify-center rounded-md text-ink hover:bg-hover"
      >
        <Icon name="chevronRight" className="h-4 w-4" />
      </Link>
    </nav>
  );
}
