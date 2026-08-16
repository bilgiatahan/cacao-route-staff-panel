import { LeaveList } from "@/components/features/leave/LeaveList";
import { LeaveRequestForm } from "@/components/features/leave/LeaveRequestForm";
import { SwapList } from "@/components/features/leave/SwapList";
import { SwapRequestForm } from "@/components/features/leave/SwapRequestForm";
import { PageHeader, SectionHeading } from "@/components/ui/Section";
import { addIsoDays, fromIsoDate, todayIso, weekdayIndex } from "@/lib/date";
import { employeeDisplayName } from "@/lib/employee";
import { formatShiftSpan } from "@/lib/format";
import { getTranslations } from "@/lib/i18n/server";
import { resolveWeekStart } from "@/lib/week-params";
import { requireSessionUser } from "@/server/auth/session";
import { getLeaveBoard } from "@/server/services/leave.service";

interface LeavePageProps {
  searchParams: Promise<{ week?: string }>;
}

export default async function LeavePage({ searchParams }: LeavePageProps) {
  const [{ locale, dict }, user, params] = await Promise.all([
    getTranslations(),
    requireSessionUser(),
    searchParams,
  ]);

  const weekStart = resolveWeekStart(params.week);
  const board = await getLeaveBoard(user, weekStart);
  const isAdmin = user.role === "admin";

  const subtitle = isAdmin
    ? board.pendingLeaveCount > 0
      ? `${board.pendingLeaveCount} ${dict.summary.pendingSuffix}`
      : dict.leave.adminSubEmpty
    : `${dict.leave.balance}: ${board.leaveBalance} ${dict.units.days}`;

  const today = todayIso();

  const shiftOptions = board.mySwapOptions.map((option) => {
    const date = fromIsoDate(option.date);
    const dayName = dict.calendar.daysShort[weekdayIndex(option.date)];
    return {
      value: option.date,
      label: `${dayName} ${date.getDate()} · ${formatShiftSpan(option.shift, dict)}`,
    };
  });

  const colleagueOptions = board.colleagues.map((employee) => ({
    value: employee.id,
    label: employeeDisplayName(employee, locale),
  }));

  return (
    <section className="flex flex-1 flex-col">
      <PageHeader title={dict.leave.title} subtitle={subtitle} />

      {!isAdmin && (
        <LeaveRequestForm
          dict={dict}
          balanceLabel={`${dict.leave.balance}: ${board.leaveBalance} ${dict.units.days}`}
          defaultStart={addIsoDays(today, 7)}
          defaultEnd={addIsoDays(today, 8)}
        />
      )}

      <SectionHeading
        title={dict.leave.requests}
        meta={`${board.pendingLeaveCount} ${dict.summary.pendingSuffix}`}
      />
      <LeaveList rows={board.leaveRows} dict={dict} locale={locale} />

      <SectionHeading title={dict.leave.swaps} />
      <SwapList rows={board.swapRows} dict={dict} locale={locale} />

      {!isAdmin && (
        <SwapRequestForm
          dict={dict}
          shiftOptions={shiftOptions}
          colleagueOptions={colleagueOptions}
        />
      )}
    </section>
  );
}
