import { PageShell } from "@/components/layout/PageShell";

import { StaffPayrollCard } from "@/components/features/team/StaffPayrollCard";
import { TeamRosterList } from "@/components/features/team/TeamRosterList";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/Section";
import { currentWeekStartIso } from "@/lib/date";
import { getTranslations } from "@/lib/i18n/server";
import { ROUTES } from "@/lib/routes";
import { requireSessionUser } from "@/server/auth/session";
import { getEmployeeDetail, getTeamOverview } from "@/server/services/team.service";

export default async function TeamPage() {
  const [{ locale, dict }, user] = await Promise.all([
    getTranslations(),
    requireSessionUser(),
  ]);

  // Always the week you are in. This screen has no week switcher, so honouring a
  // `?week=` would be state the reader can see the effect of but not the cause.
  const weekStart = currentWeekStartIso();

  if (user.role !== "admin") {
    const detail = await getEmployeeDetail(user.employeeId, weekStart);
    if (!detail) return null;

    return (
      // Card family: the page owns the tint and the gutter, every block inside
      // is a Card — the same rule Profile, Summary and Leave follow.
      <PageShell width="data">
        <section className="flex flex-1 flex-col gap-3.5 bg-fill px-4 pb-6 pt-3.5">
          <PageHeader variant="plain" title={dict.team.titleStaff} />
          <StaffPayrollCard detail={detail} dict={dict} />
        </section>
      </PageShell>
    );
  }

  const overview = await getTeamOverview(weekStart);

  return (
    <PageShell width="data">
      {/* Card family: the page owns the tint and the gutter. */}
      <section className="flex flex-1 flex-col gap-3.5 bg-fill px-4 pb-6 pt-3.5">
        <PageHeader
          variant="plain"
          title={dict.team.titleAdmin}
          subtitle={`${overview.members.length} ${dict.summary.staffSuffix} · ${dict.team.subAdmin}`}
          action={
            // Was a hand-rolled square brand-filled link — the one control on
            // this screen that ignored the radius ladder and the size scale.
            <Button href={ROUTES.teamNew} className="gap-1">
              <Icon name="plus" className="h-4 w-4" />
              {dict.team.addPerson}
            </Button>
          }
        />
        <TeamRosterList members={overview.members} dict={dict} locale={locale} />
      </section>
    </PageShell>
  );
}
