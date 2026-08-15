import { RuledList, SectionHeading } from "@/components/ui/Section";
import { MiniStatTile } from "@/components/ui/StatTile";
import { ageOn, fromIsoDate, tenureMonths } from "@/lib/date";
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

  return (
    <div>
      <div className="grid grid-cols-2 border-y-2 border-ink">
        <MiniStatTile
          label={dict.team.thisWeek}
          value={formatHours(detail.weeklyHours, dict)}
          tone={detail.overtime ? "warn" : "neutral"}
          className={detail.overtime ? "bg-warn-soft" : "bg-surface"}
        />
        <MiniStatTile
          label={dict.team.weekPay}
          value={formatMoney(weeklyTotal)}
          tone="brand"
          className="bg-surface"
        />
        <MiniStatTile
          label={dict.team.monthlyHours}
          value={formatHours(detail.monthlyHours, dict)}
          className="bg-surface-alt"
        />
        <MiniStatTile
          label={dict.team.monthlyPay}
          value={formatMoney(detail.monthlyPay)}
          tone="brand"
          className="bg-surface-alt"
        />
        <MiniStatTile
          label={dict.team.wage}
          value={`${employee.hourlyRate} ${dict.units.perHour}`}
          className="bg-surface"
        />
        <MiniStatTile
          label={dict.team.leaveBalance}
          value={`${employee.leaveBalance} ${dict.units.days}`}
          className="bg-surface"
        />
      </div>

      <dl>
        {facts
          .filter((fact) => fact.value)
          .map((fact) => (
            <div key={fact.key} className="flex items-baseline gap-3 px-4 py-3.5">
              <dt className="w-26 flex-none text-2xs font-bold uppercase tracking-[0.08em] text-muted">
                {fact.label}
              </dt>
              <dd className="min-w-0 flex-1 break-words text-base font-semibold">
                {fact.value}
              </dd>
            </div>
          ))}
      </dl>

      <SectionHeading title={dict.team.myWeeklyEarnings} />
      <RuledList>
        <ul>
          {payRows.map((cell) => {
            const shift = cell.shift!;
            const hours = (shift.endMinutes - shift.startMinutes) / 60;
            const date = fromIsoDate(cell.date);

            return (
              <li
                key={cell.date}
                className="flex items-center justify-between gap-2.5 px-4 py-2.5"
              >
                <span className="w-16 flex-none text-sm font-semibold">
                  {dict.calendar.daysShort[(date.getDay() + 6) % 7]} {date.getDate()}
                </span>
                <span className="tabular flex-1 text-sm text-[#605d5d]">
                  {formatShiftSpan(shift, dict)}
                </span>
                <span className="tabular text-sm">{formatHours(hours, dict)}</span>
                <span className={cn("tabular w-[74px] text-right text-sm font-bold")}>
                  {formatMoney(hours * employee.hourlyRate)}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between border-b-2 border-ink bg-brand px-4 py-3.5 text-white">
          <span className="text-xs font-bold uppercase tracking-[0.1em]">
            {dict.team.weekPay}
          </span>
          <span className="tabular text-2xl font-extrabold">{formatMoney(weeklyTotal)}</span>
        </div>
      </RuledList>
    </div>
  );
}
