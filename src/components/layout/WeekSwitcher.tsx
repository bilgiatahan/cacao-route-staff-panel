import Link from "next/link";

import { WeekPicker } from "@/components/layout/WeekPicker";
import type { WeekPickerData } from "@/components/layout/week-options";
import { Icon } from "@/components/ui/Icon";

export interface WeekSwitcherProps {
  /** Pre-built by the page with `panelHref`, so the rest of the URL survives. */
  previousHref: string;
  nextHref: string;
  /** Server-formatted range, e.g. "3–9 Aug". */
  label: string;
  previousLabel: string;
  nextLabel: string;
  /** Names the control as a whole for assistive tech. */
  ariaLabel: string;
  /** Rows, shortcut and strings for the label's picker — `buildWeekPicker`. */
  picker: WeekPickerData;
}

/**
 * Previous / current / next week — the arrows as links, the label as a picker.
 *
 * This used to be a Client Component that read `useSearchParams` and re-derived
 * the label in the browser — necessary when it lived in the panel layout, which
 * cannot see search params. Mounted in the page instead, none of that is needed:
 * the page already knows the week, the view and the day, so it builds every href
 * with `panelHref` and formats every label with `formatWeekLabel`. No second
 * copy of the date maths, and the whole thing stays linkable.
 *
 * The label is now a button that opens `WeekPicker`, because stepping was the
 * *only* way to move and distance cost a round trip per week. That picker is the
 * one piece that needs the browser, so it is the one piece that ships as a
 * Client Component; this stays a Server Component and the arrows stay links.
 */
export function WeekSwitcher({
  previousHref,
  nextHref,
  label,
  previousLabel,
  nextLabel,
  ariaLabel,
  picker,
}: WeekSwitcherProps) {
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
      {/* The range is the control's current value, and the way to change it. */}
      <WeekPicker label={label} {...picker} />
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
