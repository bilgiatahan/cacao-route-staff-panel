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
import { EmployeeMonthTable } from "@/components/features/team/EmployeeMonthTable";
import { fromIsoDate, tenureMonths, weekdayIndex } from "@/lib/date";
import {
  formatFullDate,
  formatHourlyRate,
  formatHours,
  formatMoney,
  formatMonthName,
  formatShiftSpan,
  formatWeekLabel,
} from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { EmployeeDetail } from "@/server/services/team.service";
import type { IsoDate } from "@/types/domain";

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
  /** The week being reported — always the current one; there is no switcher. */
  weekStart: IsoDate;
  /** Today, so the month table can mark the week you are living in. */
  today: IsoDate;
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
 * Same two blocks the manager reads on the employee detail page, and built from
 * the same pieces: a week and a month, each opening on its own pair of
 * `StatCard`s and closing on a table. What differs is navigation, not shape —
 * the manager can step through any week and any month, so their blocks carry a
 * `PeriodSwitcher`; this screen is fixed to the week you are in and the month
 * that week falls in, so the period is stated as `meta` instead of offered as a
 * control. A switcher whose arrows lead nowhere would be worse than no switcher.
 *
 * The week table keeps its `earned` column, which the manager's `WeekShiftList`
 * has no use for: on this screen the money per day *is* the subject.
 *
 * Contact details are deliberately not repeated here. Position, birth date,
 * phone, email and address live on Profile, and this screen is about pay.
 */
export function StaffPayrollCard({
  detail,
  dict,
  weekStart,
  today,
}: StaffPayrollCardProps) {
  const { employee, row } = detail;
  const payRows = (row?.cells ?? []).filter((cell) => cell.shift);
  const weeklyTotal = detail.weeklyPay.total;
  const monthHint = `${detail.month.weeksWorked}/${detail.month.weeks.length} ${dict.units.weeks}`;

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
    <div className="contents lg:flex lg:items-start lg:gap-3.5">
      {/*
        The week leads: it is the pay being earned right now. Seven rows of four
        figures run across 1216px read as a nearly empty table, so from `lg` the
        week takes the wider column and the month stacks beside it — the same
        7/5 split the manager's page uses.
      */}
      <div className="contents lg:block lg:min-w-0 lg:basis-0 lg:grow-7">
        <SectionBlock
          title={dict.team.myWeeklyEarnings}
          meta={formatWeekLabel(weekStart, dict)}
        >
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              icon="timetable"
              accent="green"
              label={dict.team.weekHours}
              value={formatHours(detail.weeklyHours, dict)}
            />
            <StatCard
              icon="wallet"
              accent="green"
              label={dict.team.weekPay}
              value={formatMoney(weeklyTotal)}
            />
          </div>

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
                    <li
                      key={cell.date}
                      className={cn(EARNINGS_COLUMNS, TABLE_ROW, "py-2.5")}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Icon
                          name="timetable"
                          className="h-4 w-4 flex-none text-muted"
                        />
                        <span className="truncate text-sm font-semibold">
                          {dict.calendar.daysShort[weekdayIndex(cell.date)]}{" "}
                          {date.getDate()}
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

              <TableTotal
                label={dict.team.weekPay}
                value={formatMoney(weeklyTotal)}
              />
            </TableCard>
          )}
        </SectionBlock>
      </div>

      <div className="contents lg:flex lg:min-w-0 lg:basis-0 lg:grow-5 lg:flex-col lg:gap-3.5">
        {/* The month is what was actually worked in it, not this week projected
          forward — the table underneath shows which weeks the total came from,
          and the hint counts the ones that carried a shift. */}
        <SectionBlock
          title={dict.team.myMonthlyEarnings}
          meta={formatMonthName(detail.month.month, dict)}
        >
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              icon="clock"
              accent="green"
              label={dict.team.monthlyHours}
              value={formatHours(detail.month.hours, dict)}
              hint={monthHint}
            />
            <StatCard
              icon="wallet"
              accent="green"
              label={dict.team.monthlyPay}
              value={formatMoney(detail.month.pay)}
              hint={monthHint}
            />
          </div>
          <EmployeeMonthTable month={detail.month} dict={dict} today={today} />
        </SectionBlock>

        <SectionBlock title={dict.profile.employment}>
          <Card padding="md">
            <DetailList items={terms} />
          </Card>
        </SectionBlock>
      </div>
    </div>
  );
}
