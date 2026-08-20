import Link from "next/link";

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
}

/**
 * Previous / current / next week, as links.
 *
 * This used to be a Client Component that read `useSearchParams` and re-derived
 * the label in the browser — necessary when it lived in the panel layout, which
 * cannot see search params. Mounted in the page instead, none of that is needed:
 * the page already knows the week, the view and the day, so it builds both hrefs
 * with `panelHref` and formats the label with `formatWeekLabel`. No client
 * JavaScript, no second copy of the date maths, and the whole thing stays
 * server-rendered and linkable.
 */
export function WeekSwitcher({
  previousHref,
  nextHref,
  label,
  previousLabel,
  nextLabel,
  ariaLabel,
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
      {/* The range is the control's current value, so it is announced with it. */}
      <span className="tabular whitespace-nowrap border-x border-line px-2.5 text-sm font-bold">
        {label}
      </span>
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
