import { Avatar } from "@/components/ui/Avatar";
import { accentForId, Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { employeeFullName, employeeInitials, employeePosition } from "@/lib/employee";
import type { Dictionary } from "@/lib/i18n";
import { panelHref, ROUTES } from "@/lib/routes";
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
 * A phone stacks the secondary facts under the name because there is no room
 * for anything else; from `lg` the same five facts become five columns. The two
 * presentations swap with `lg:hidden` / `hidden lg:block`, so exactly one is
 * rendered *and* exposed to assistive tech at any width — `display: none`
 * removes an element from the accessibility tree, not just from the page.
 *
 * No column headers: `formatHours` carries its unit and the rate carries
 * "£/h", so every column already states what it is.
 */
export function TeamRosterList({ members, locale, weekStart }: TeamRosterListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {members.map((member) => {
        const { employee } = member;
        const position = employeePosition(employee, locale);

        return (
          <li key={employee.id}>
            <Card
              href={panelHref(ROUTES.teamMember(employee.id), { week: weekStart })}
              padding="sm"
              className="flex items-center gap-2.5 lg:gap-4 lg:px-4"
            >
              <Avatar
                initials={employeeInitials(employee)}
                tone={accentForId(employee.id)}
                className="rounded-full"
              />

              <div className="min-w-0 flex-1">
                <div className="truncate text-md font-semibold">
                  {employeeFullName(employee)}
                </div>
                {/* Phone: position and the chips ride under the name. */}
                <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate text-xs text-muted">{position}</span>
                </div>
              </div>

              <Icon name="chevronRight" className="h-4 w-4 text-muted" />
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
