import Link from "next/link";

import { StaffPayrollCard } from "@/components/features/team/StaffPayrollCard";
import { TeamRosterList } from "@/components/features/team/TeamRosterList";
import { PageHeader } from "@/components/ui/Section";
import { getTranslations } from "@/lib/i18n/server";
import { panelHref, ROUTES } from "@/lib/routes";
import { resolveWeekStart } from "@/lib/week-params";
import { requireSessionUser } from "@/server/auth/session";
import { getEmployeeDetail, getTeamOverview } from "@/server/services/team.service";

interface TeamPageProps {
  searchParams: Promise<{ week?: string }>;
}

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const [{ locale, dict }, user, params] = await Promise.all([
    getTranslations(),
    requireSessionUser(),
    searchParams,
  ]);

  const weekStart = resolveWeekStart(params.week);

  if (user.role !== "admin") {
    const detail = await getEmployeeDetail(user.employeeId, weekStart);
    if (!detail) return null;

    return (
      // The staff view is card family: tinted ground, cards gutter to gutter.
      <section className="flex flex-1 flex-col gap-3.5 bg-fill px-4 pb-6">
        <PageHeader variant="plain" title={dict.team.titleStaff} />
        <StaffPayrollCard detail={detail} dict={dict} locale={locale} />
      </section>
    );
  }

  const overview = await getTeamOverview(weekStart);

  return (
    <section className="flex flex-1 flex-col">
      <PageHeader
        title={dict.team.titleAdmin}
        subtitle={`${overview.members.length} ${dict.summary.staffSuffix} · ${dict.team.subAdmin}`}
        action={
          <Link
            href={panelHref(ROUTES.teamNew, { week: weekStart })}
            className="inline-flex items-center bg-brand px-3 py-2.5 text-sm font-bold tracking-[0.04em] text-white hover:bg-brand-dark"
          >
            + {dict.team.addPerson}
          </Link>
        }
      />
      <TeamRosterList
        members={overview.members}
        dict={dict}
        locale={locale}
        weekStart={weekStart}
      />
    </section>
  );
}
