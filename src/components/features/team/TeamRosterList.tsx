import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { accentForId, Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { employeeFullName, employeeInitials, employeePosition } from "@/lib/employee";
import { formatHourlyRate, formatHours } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { panelHref, ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { TeamMemberSummary } from "@/server/services/team.service";
import type { IsoDate, Locale } from "@/types/domain";

export interface TeamRosterListProps {
  members: TeamMemberSummary[];
  dict: Dictionary;
  locale: Locale;
  weekStart: IsoDate;
}

/**
 * The team, one Card per person, the whole row a link to their detail page.
 *
 * Migrated off the Ruled family: the list was a 2px ink rule over edge-to-edge
 * rows on bare canvas, which is the one framing the rest of the product no
 * longer uses. It is now the same object `OnShiftList` and `PendingActions` are
 * — a stack of hairline cards on the page's tint, with a round accent avatar
 * whose colour is derived from the person's id, so the same face keeps the same
 * colour on every screen that shows them.
 *
 * Overtime used to be carried by two colour changes and nothing else: a warm
 * avatar tint and warm hours. It is a named `Badge` now. Contract was plain grey
 * text glued to the position with a middot; it is a `Badge` too, which is what
 * makes a mixed list of full- and part-timers scannable.
 *
 * A phone stacks the secondary facts under the name because there is no room
 * for anything else; from `lg` the same five facts become five columns. The two
 * presentations swap with `lg:hidden` / `hidden lg:block`, so exactly one is
 * rendered *and* exposed to assistive tech at any width — `display: none`
 * removes an element from the accessibility tree, not just from the page.
 *
 * No column headers: `formatHours` carries its unit and the rate carries
 * "£/h", so every column already states what it is.
 */
export function TeamRosterList({ members, dict, locale, weekStart }: TeamRosterListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {members.map((member) => {
        const { employee, overtime } = member;
        const position = employeePosition(employee, locale);
        const contract = dict.team.contracts[employee.contract];
        const hours = formatHours(member.weeklyHours, dict);
        const rate = formatHourlyRate(employee.hourlyRate, dict);
        const hoursTone = overtime ? "text-warn-dark" : "text-ink";

        const badges = (
          <>
            <Badge>{contract}</Badge>
            {overtime ? <Badge tone="warning">{dict.team.overtime}</Badge> : null}
          </>
        );

        return (
          <li key={employee.id}>
            <Card
              href={panelHref(ROUTES.teamMember(employee.id), { week: weekStart })}
              padding="sm"
              className="flex items-center gap-2.5 lg:gap-4 lg:px-4"
            >
              <Avatar
                initials={employeeInitials(employee, locale)}
                tone={accentForId(employee.id)}
                className="rounded-full"
              />

              <div className="min-w-0 flex-1">
                <div className="truncate text-md font-semibold">
                  {employeeFullName(employee, locale)}
                </div>
                {/* Phone: position and the chips ride under the name. */}
                <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 lg:hidden">
                  <span className="truncate text-xs text-muted">{position}</span>
                  {badges}
                </div>
              </div>

              {/* Desk: the same facts, one column each. */}
              <div className="hidden min-w-0 lg:block lg:w-40 xl:w-52">
                <span className="block truncate text-sm text-muted">{position}</span>
              </div>
              <div className="hidden flex-none items-center gap-1.5 lg:flex">{badges}</div>

              {/* Phone: hours over rate, right-aligned. */}
              <div className="flex-none text-right lg:hidden">
                <div className={cn("tabular text-sm font-bold", hoursTone)}>{hours}</div>
                <div className="tabular text-xs text-muted">{rate}</div>
              </div>

              <div
                className={cn(
                  "tabular hidden flex-none text-right text-sm font-bold lg:block lg:w-20",
                  hoursTone,
                )}
              >
                {hours}
              </div>
              <div className="tabular hidden flex-none text-right text-sm text-muted lg:block lg:w-24">
                {rate}
              </div>

              <Icon name="chevronRight" className="h-4 w-4 flex-none text-muted" />
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
