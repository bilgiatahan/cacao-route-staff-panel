import { type Accent, Card, IconTile } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { SectionHeading } from "@/components/ui/Section";
import { STAT_TONES, type StatTone } from "@/components/ui/StatTile";
import {
  TABLE_ROW,
  TableCard,
  TableHead,
  TableTotal,
} from "@/components/ui/TableCard";
import { ageOn, fromIsoDate, tenureMonths, weekdayIndex } from "@/lib/date";
import { employeePosition } from "@/lib/employee";
import {
  formatFullDate,
  formatHours,
  formatMoney,
  formatShiftSpan,
} from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { EmployeeDetail } from "@/server/services/team.service";
import type { Locale } from "@/types/domain";

/** Day · span · worked · earned. Narrow enough to survive a 360px phone. */
const EARNINGS_COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_84px_62px_78px] gap-1.5 px-3.5";

export interface StaffPayrollCardProps {
  detail: EmployeeDetail;
  dict: Dictionary;
  locale: Locale;
}

function tenureLabel(hiredAt: string, dict: Dictionary): string {
  const months = tenureMonths(hiredAt);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = years > 0 ? [`${years} ${dict.units.years}`] : [];
  parts.push(`${rest} ${dict.units.months}`);
  return parts.join(" ");
}

/** The staff-facing "my payroll" tab: profile facts plus a day-by-day breakdown. */
export function StaffPayrollCard({ detail, dict, locale }: StaffPayrollCardProps) {
  const { employee, row } = detail;

  const facts: Array<{ key: string; label: string; value: string }> = [
    { key: "position", label: dict.team.position, value: employeePosition(employee, locale) },
    {
      key: "contract",
      label: dict.team.contract,
      value: dict.team.contracts[employee.contract],
    },
  ];

  if (employee.birthDate) {
    facts.push({
      key: "birth",
      label: dict.team.birth,
      value: `${formatFullDate(employee.birthDate, dict)} · ${ageOn(employee.birthDate)} ${dict.team.age}`,
    });
  }
  if (employee.hiredAt) {
    facts.push({
      key: "hired",
      label: dict.team.hired,
      value: `${formatFullDate(employee.hiredAt, dict)} · ${tenureLabel(employee.hiredAt, dict)} ${dict.team.tenure}`,
    });
  }
  facts.push(
    { key: "phone", label: dict.team.phone, value: employee.phone },
    { key: "email", label: dict.team.email, value: employee.email },
    { key: "address", label: dict.team.address, value: employee.address },
  );

  const payRows = (row?.cells ?? []).filter((cell) => cell.shift);
  const weeklyTotal = detail.weeklyPay.total;

  const stats: Array<{
    key: string;
    icon: IconName;
    accent: Accent;
    label: string;
    value: string;
    tone?: StatTone;
  }> = [
    {
      key: "weekHours",
      icon: "timetable",
      // Overtime is the one number here that has to catch the eye.
      accent: detail.overtime ? "amber" : "green",
      label: dict.team.thisWeek,
      value: formatHours(detail.weeklyHours, dict),
      tone: detail.overtime ? "warn" : undefined,
    },
    {
      key: "weekPay",
      icon: "wallet",
      accent: "green",
      label: dict.team.weekPay,
      value: formatMoney(weeklyTotal),
      tone: "brand",
    },
    {
      key: "monthHours",
      icon: "clock",
      accent: "green",
      label: dict.team.monthlyHours,
      value: formatHours(detail.monthlyHours, dict),
    },
    {
      key: "monthPay",
      icon: "wallet",
      accent: "green",
      label: dict.team.monthlyPay,
      value: formatMoney(detail.monthlyPay),
      tone: "brand",
    },
    {
      key: "wage",
      icon: "pay",
      accent: "green",
      label: dict.team.wage,
      value: `${employee.hourlyRate} ${dict.units.perHour}`,
    },
    {
      key: "leave",
      icon: "hourglass",
      accent: "green",
      label: dict.team.leaveBalance,
      value: `${employee.leaveBalance} ${dict.units.days}`,
    },
  ];

  return (
    // A stack of card surfaces — the page owns the tint and the gutter, the same
    // way the summary tab does.
    <div className="flex flex-col gap-4">
      <Card className="grid grid-cols-2 overflow-hidden">
        {stats.map((stat, index) => (
          <div
            key={stat.key}
            className={cn(
              "px-3.5 py-3",
              index > 1 && "border-t border-line",
              index % 2 === 1 && "border-l border-line",
            )}
          >
            <div className="flex items-center gap-2.5">
              <IconTile name={stat.icon} accent={stat.accent} />
              <span className="label-eyebrow min-w-0 truncate">{stat.label}</span>
            </div>
            <div
              className={cn(
                "tabular mt-2 text-2xl font-extrabold -tracking-[0.02em]",
                STAT_TONES[stat.tone ?? "neutral"],
              )}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </Card>

      <Card className="overflow-hidden">
        <dl>
          {facts
            .filter((fact) => fact.value)
            .map((fact, index) => (
              <div
                key={fact.key}
                className={cn(
                  "flex items-baseline gap-3 px-3.5 py-3",
                  index > 0 && "border-t border-line",
                )}
              >
                <dt className="w-26 flex-none text-2xs font-bold uppercase tracking-[0.08em] text-muted">
                  {fact.label}
                </dt>
                <dd className="min-w-0 flex-1 break-words text-sm font-semibold">
                  {fact.value}
                </dd>
              </div>
            ))}
        </dl>
      </Card>

      <div>
        <SectionHeading variant="card" icon="summary" title={dict.team.myWeeklyEarnings} />
        <TableCard>
          <TableHead columns={"grid grid-cols-[minmax(0,1fr)_84px_62px_78px] gap-1.5 px-3.5 bg-[#EEF2F0] text-brand"}>
            <span>{dict.team.colDay}</span>
            <span className="text-center">{dict.team.colTime}</span>
            <span className="text-center">{dict.team.colWorked}</span>
            <span className="text-center">{dict.team.colEarned}</span>
          </TableHead>

          <ul>
            {payRows.map((cell) => {
              const shift = cell.shift!;
              const hours = (shift.endMinutes - shift.startMinutes) / 60;
              const date = fromIsoDate(cell.date);

              return (
                <li key={cell.date} className={cn(EARNINGS_COLUMNS, TABLE_ROW, "py-2.5")}>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Icon
                      name="timetable"
                      className="h-[15px] w-[15px] text-accent-green"
                    />
                    <span className="truncate text-sm font-semibold">
                      {dict.calendar.daysShort[weekdayIndex(cell.date)]} {date.getDate()}
                    </span>
                  </span>
                  <span className="tabular text-center text-sm text-muted">
                    {formatShiftSpan(shift, dict)}
                  </span>
                  <span className="flex justify-center">
                    <span className="tabular rounded-full bg-fill px-2 py-0.5 text-2xs font-bold text-ink">
                      {formatHours(hours, dict)}
                    </span>
                  </span>
                  <span className="tabular text-center text-sm font-bold text-brand">
                    {formatMoney(hours * employee.hourlyRate)}
                  </span>
                </li>
              );
            })}
          </ul>

          <TableTotal label={dict.team.weekPay} value={formatMoney(weeklyTotal)} />
        </TableCard>
      </div>
    </div>
  );
}
