import { Badge } from "@/components/ui/Badge";
import { Card, StatCard } from "@/components/ui/Card";
import { DetailList, type DetailItem } from "@/components/ui/DetailList";
import { EmptyState, SectionBlock } from "@/components/ui/Section";
import { Icon } from "@/components/ui/Icon";
import {
  TABLE_ROW,
  TableCard,
  TableHead,
  TableTotal,
} from "@/components/ui/TableCard";
import { fromIsoDate, tenureMonths, weekdayIndex } from "@/lib/date";
import {
  formatFullDate,
  formatHourlyRate,
  formatHours,
  formatHoursValue,
  formatMoney,
  formatShiftSpan,
} from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { EmployeeDetail } from "@/server/services/team.service";

/**
 * Day · span · worked · earned. Narrow enough to survive a 360px phone, and
 * from `lg` wide enough that the figures are not pinned to the right edge of a
 * column three times the width they were designed for.
 */
const EARNINGS_COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_84px_62px_78px] gap-1.5 px-3.5 " +
  "lg:grid-cols-[minmax(0,1fr)_120px_96px_120px] lg:gap-3 lg:px-4";

export interface StaffPayrollCardProps {
  detail: EmployeeDetail;
  dict: Dictionary;
}

function tenureLabel(hiredAt: string, dict: Dictionary): string {
  const months = tenureMonths(hiredAt);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = years > 0 ? [`${years} ${dict.units.years}`] : [];
  parts.push(`${rest} ${dict.units.months}`);
  return parts.join(" ");
}

/**
 * The staff-facing "my pay" screen.
 *
 * Hierarchy, rather than six identical tiles: this week is what you are being
 * paid for, the month is a projection of it, and the terms behind both are
 * reference facts the manager owns — so they read as a `DetailList`, the same
 * treatment Profile gives its work details.
 *
 * Contact details are deliberately not repeated here. Position, birth date,
 * phone, email and address live on Profile, and this screen is about pay.
 */
export function StaffPayrollCard({ detail, dict }: StaffPayrollCardProps) {
  const { employee, row } = detail;
  const payRows = (row?.cells ?? []).filter((cell) => cell.shift);
  const weeklyTotal = detail.weeklyPay.total;
  const overtimeHours = detail.weeklyPay.overtimeHours;

  // The terms of employment — read-only, and someone else's decision.
  const terms: DetailItem[] = [
    {
      key: "contract",
      icon: "document",
      label: dict.team.contract,
      value: dict.team.contracts[employee.contract],
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

  if (employee.hiredAt) {
    terms.push({
      key: "hired",
      icon: "timetable",
      label: dict.team.hired,
      value: `${formatFullDate(employee.hiredAt, dict)} · ${tenureLabel(employee.hiredAt, dict)} ${dict.team.tenure}`,
    });
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/*
        Two pairs stacked on a phone; one band of four on a desk. Keeping them
        as two grids rather than merging into one four-column grid is what makes
        that free: the wrapper is `contents` below `lg`, so the phone still gets
        exactly the two rows it has today, week above month.
      */}
      <div className="contents lg:flex lg:gap-2">
      {/* This week leads: it is the pay being earned right now. */}
      <div className="grid grid-cols-2 gap-2 lg:min-w-0 lg:flex-1">
        <StatCard
          icon="timetable"
          accent={detail.overtime ? "amber" : "green"}
          label={dict.team.thisWeek}
          value={formatHours(detail.weeklyHours, dict)}
          // Overtime is the one number that has to catch the eye — and it says
          // so in words, not only in a warm tint.
          highlight={detail.overtime}
          hint={
            detail.overtime
              ? `+${formatHoursValue(overtimeHours)}${dict.units.hourSuffix} ${dict.team.overtime}`
              : undefined
          }
        />
        <StatCard
          icon="wallet"
          accent="green"
          label={dict.team.weekPay}
          value={formatMoney(weeklyTotal)}
        />
      </div>

      {/* The month is a projection of the week, so it sits one step quieter. */}
      <div className="grid grid-cols-2 gap-2 lg:min-w-0 lg:flex-1">
        <StatCard
          icon="clock"
          accent="green"
          label={dict.team.monthlyHours}
          value={formatHours(detail.monthlyHours, dict)}
          hint={`${detail.weeksInMonth} ${dict.units.weeks}`}
        />
        <StatCard
          icon="wallet"
          accent="green"
          label={dict.team.monthlyPay}
          value={formatMoney(detail.monthlyPay)}
          hint={`${detail.weeksInMonth} ${dict.units.weeks}`}
        />
      </div>
      </div>

      {/*
        The earnings breakdown is at most seven rows of four figures; run across
        1216px it reads as a nearly empty table. Paired with the terms card it
        gets a measure that suits it, and the terms stop being a sparse strip.
      */}
      <div className="contents lg:flex lg:items-start lg:gap-3.5">
      <SectionBlock
        className="lg:min-w-0 lg:basis-0 lg:grow-[7]"
        title={dict.team.myWeeklyEarnings}
      >
        {payRows.length === 0 ? (
          <Card>
            <EmptyState icon="timetable">{dict.team.noEarnings}</EmptyState>
          </Card>
        ) : (
          <TableCard>
            {/* `columns` is a layout prop; colours used to be smuggled through
                it, which is why the header looked different from every other
                table in the app. */}
            <TableHead columns={EARNINGS_COLUMNS}>
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
                      <Icon name="timetable" className="h-4 w-4 flex-none text-muted" />
                      <span className="truncate text-sm font-semibold">
                        {dict.calendar.daysShort[weekdayIndex(cell.date)]} {date.getDate()}
                      </span>
                    </span>
                    <span className="tabular text-center text-sm text-muted">
                      {formatShiftSpan(shift, dict)}
                    </span>
                    <span className="flex justify-center">
                      <Badge>{formatHours(hours, dict)}</Badge>
                    </span>
                    <span className="tabular text-center text-sm font-bold">
                      {formatMoney(hours * employee.hourlyRate)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <TableTotal label={dict.team.weekPay} value={formatMoney(weeklyTotal)} />
          </TableCard>
        )}
      </SectionBlock>

      <SectionBlock
        className="lg:min-w-0 lg:basis-0 lg:grow-[5]"
        title={dict.profile.employment}
      >
        <Card padding="md">
          <DetailList items={terms} />
        </Card>
      </SectionBlock>
      </div>
    </div>
  );
}
