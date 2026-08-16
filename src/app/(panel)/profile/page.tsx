import { ProfileForm } from "@/components/features/profile/ProfileForm";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { SectionHeading } from "@/components/ui/Section";
import { employeeFullName, employeeInitials, employeePosition } from "@/lib/employee";
import { formatFullDate } from "@/lib/format";
import { getTranslations } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { requireCurrentEmployee } from "@/server/auth/session";
import { updateProfileAction } from "@/server/actions/profile.actions";

export default async function ProfilePage() {
  const [{ locale, dict }, { user, employee }] = await Promise.all([
    getTranslations(),
    requireCurrentEmployee(),
  ]);

  // Everything the person cannot set for themselves — shown so the page still
  // answers "what am I on?", but read-only because it is the manager's call.
  const workRows: { key: string; icon: IconName; label: string; value: string }[] = [
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
      value: `${employee.hourlyRate} ${dict.units.perHour}`,
    },
    {
      key: "leave",
      icon: "hourglass",
      label: dict.team.leaveBalance,
      value: `${employee.leaveBalance} ${dict.units.days}`,
    },
  ];

  return (
    // Card family: the page owns the tint and the gutter, every block is a surface.
    <section className="flex flex-1 flex-col gap-3.5 bg-fill px-4 pb-6 pt-3.5">
      <Card className="flex items-center gap-3 px-3.5 py-3">
        <Avatar
          initials={employeeInitials(employee, locale)}
          size="lg"
          solid
          className="rounded-full"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold">
            {employeeFullName(employee, locale)}
          </h1>
          <p className="truncate text-sm text-muted">
            {user.role === "admin"
              ? dict.brand.managerTitle
              : employeePosition(employee, locale)}
          </p>
        </div>
      </Card>

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

      <Card className="px-3.5 pb-1 pt-3">
        <SectionHeading variant="card" icon="briefcase" title={dict.profile.employment} />
        <dl>
          {workRows.map((row, index) => (
            <div
              key={row.key}
              className={cn(
                "flex items-center gap-2.5 py-2.5",
                index > 0 && "border-t border-line",
              )}
            >
              <Icon name={row.icon} className="h-4 w-4 text-accent-green" />
              <dt className="label-eyebrow min-w-0 flex-1 truncate">{row.label}</dt>
              <dd className="tabular flex-none text-sm font-bold text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <p className="flex items-start gap-1.5 px-0.5 text-xs text-muted-soft">
        <Icon name="info" className="mt-px h-3.5 w-3.5" />
        <span>{dict.profile.employmentHint}</span>
      </p>
    </section>
  );
}
