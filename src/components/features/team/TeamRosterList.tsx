import Link from "next/link";

import { Avatar } from "@/components/ui/Avatar";
import { RuledList } from "@/components/ui/Section";
import { employeeFullName, employeeInitials, employeePosition } from "@/lib/employee";
import { formatHours } from "@/lib/format";
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

export function TeamRosterList({ members, dict, locale, weekStart }: TeamRosterListProps) {
  return (
    <RuledList>
      <ul>
        {members.map((member) => (
          <li key={member.employee.id}>
            <Link
              href={panelHref(ROUTES.teamMember(member.employee.id), { week: weekStart })}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-alt"
            >
              <Avatar
                initials={employeeInitials(member.employee, locale)}
                tone={member.overtime ? "warn" : "brand"}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-md font-bold">
                  {employeeFullName(member.employee, locale)}
                </div>
                <div className="truncate text-xs text-muted">
                  {employeePosition(member.employee, locale)} ·{" "}
                  {dict.team.contracts[member.employee.contract]}
                </div>
              </div>
              <div className="flex-none text-right">
                <div
                  className={cn(
                    "tabular text-sm font-bold",
                    member.overtime ? "text-warn-dark" : "text-ink",
                  )}
                >
                  {formatHours(member.weeklyHours, dict)}
                </div>
                <div className="tabular text-xs text-muted">
                  {member.employee.hourlyRate} {dict.units.perHour}
                </div>
              </div>
              <span aria-hidden className="flex-none text-md text-[#bdbaba]">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </RuledList>
  );
}
