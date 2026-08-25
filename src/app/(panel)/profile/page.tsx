import { PageShell } from "@/components/layout/PageShell";
import { PasswordForm } from "@/components/features/profile/PasswordForm";
import { ProfileForm } from "@/components/features/profile/ProfileForm";
import { Card } from "@/components/ui/Card";
import { DetailList, type DetailItem } from "@/components/ui/DetailList";
import { Hint, PageHeader, SectionHeading } from "@/components/ui/Section";
import { employeePosition } from "@/lib/employee";
import { formatFullDate, formatHourlyRate } from "@/lib/format";
import { getTranslations } from "@/lib/i18n/server";
import { requireCurrentEmployee } from "@/server/auth/session";
import { changePasswordAction, updateProfileAction } from "@/server/actions/profile.actions";

/**
 * The reference Card-family screen.
 *
 * The rules it sets for the migrations that follow:
 *
 *  - The page owns the tint and the gutter; every block inside is a `Card`.
 *  - The screen owns its measure via `PageShell`. Profile stays constrained: it
 *    is a form, and a form wants a short line length however wide the monitor
 *    is. `medium` opens it from 560 to 720 on a desk and no further; the two
 *    columns the fields already form at `sm` are what that room is for.
 *  - Identity is not repeated. The drawer already shows who is signed in, so the
 *    page opens with a title rather than an avatar card.
 *  - Editable and read-only never look alike. Inputs are inputs; facts the
 *    manager controls are a `DetailList`, not a disabled input.
 */
export default async function ProfilePage() {
  const [{ locale, dict }, { user, employee }] = await Promise.all([
    getTranslations(),
    requireCurrentEmployee(),
  ]);

  // "What am I on?" is a staff question. An admin sets these terms rather than
  // being subject to them and never takes a roster row, so wage, contract and
  // leave balance would be figures about nobody.
  const showsEmployment = user.role !== "admin";

  // Everything the person cannot set for themselves — shown so the page still
  // answers "what am I on?", but read-only because it is the manager's call.
  const workRows: DetailItem[] = [
    {
      key: "position",
      icon: "user",
      label: dict.team.position,
      value: employeePosition(employee, locale),
    },
    {
      key: "contract",
      icon: "document",
      label: dict.team.contract,
      value: dict.team.contracts[employee.contract],
    },
    {
      key: "hired",
      icon: "timetable",
      label: dict.team.hired,
      value: employee.hiredAt ? formatFullDate(employee.hiredAt, dict) : dict.common.dash,
    },
    {
      key: "wage",
      icon: "pay",
      label: dict.team.wage,
      value: formatHourlyRate(employee.hourlyRate, dict),
    },
    {
      key: "leave",
      icon: "hourglass",
      label: dict.team.leaveBalance,
      value: `${employee.leaveBalance} ${dict.units.days}`,
    },
  ];

  return (
    <PageShell width="medium">
      <section className="flex flex-1 flex-col gap-3.5 bg-fill px-4 pb-6 pt-3.5">
        <PageHeader variant="plain" title={dict.profile.title} />

        <ProfileForm
          dict={dict}
          values={{
            firstName: employee.firstName,
            lastName: employee.lastName,
            birthDate: employee.birthDate ?? "",
            phone: employee.phone,
            email: employee.email,
            address: employee.address,
          }}
          action={updateProfileAction}
        />

        {/* Its own form and its own action: changing a password should not be
            able to fail a phone number, or vice versa. */}
        <PasswordForm dict={dict} action={changePasswordAction} />

        {showsEmployment && (
          <Card padding="md">
            <SectionHeading variant="card" icon="briefcase" title={dict.profile.employment} />
            <DetailList items={workRows} />
            {/* The hint explains this card, so it lives in it rather than floating
                under the page as an unattached paragraph. */}
            <Hint icon="info" className="pt-2.5">
              {dict.profile.employmentHint}
            </Hint>
          </Card>
        )}
      </section>
    </PageShell>
  );
}
