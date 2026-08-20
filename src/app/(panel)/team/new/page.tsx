import { PageShell } from "@/components/layout/PageShell";

import { EmployeeForm } from "@/components/features/team/EmployeeForm";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/Section";
import { getTranslations } from "@/lib/i18n/server";
import { panelHref, ROUTES } from "@/lib/routes";
import { resolveWeekStart } from "@/lib/week-params";
import { requireAdmin } from "@/server/auth/session";
import { createEmployeeAction } from "@/server/actions/employee.actions";

interface NewEmployeePageProps {
  searchParams: Promise<{ week?: string }>;
}

/** The page owns the tint and the gutter; every block inside is a Card. */
const PAGE = "flex flex-1 flex-col gap-3.5 bg-fill px-4 pb-6 pt-3.5";

export default async function NewEmployeePage({ searchParams }: NewEmployeePageProps) {
  const [{ dict }, , query] = await Promise.all([
    getTranslations(),
    requireAdmin(),
    searchParams,
  ]);

  const weekStart = resolveWeekStart(query.week);

  return (
    // A form wants a short line whatever the monitor is: 720px, not 1216.
    <PageShell width="medium">
      <section className={PAGE}>
        {/* The "+" avatar the ruled bar used to open with stood in for a person
            who does not exist yet; the title already says that. */}
        <PageHeader
          variant="plain"
          title={dict.team.newPerson}
          subtitle={dict.team.editHint}
          action={
            // `md`, not `sm`: 44px. `sm` is 40px and is for dense inline
            // controls, which a page-level back affordance is not.
            <Button href={panelHref(ROUTES.team, { week: weekStart })} variant="outline">
              {dict.common.back}
            </Button>
          }
        />

        <EmployeeForm
          dict={dict}
          mode="create"
          values={{
            firstName: "",
            lastName: "",
            position: "",
            contract: "part",
            birthDate: "",
            hiredAt: "",
            hourlyRate: 130,
            leaveBalance: 0,
            phone: "",
            email: "",
            address: "",
          }}
          action={createEmployeeAction}
        />
      </section>
    </PageShell>
  );
}
