import { LeaveList } from "@/components/features/leave/LeaveList";
import { PageShell } from "@/components/layout/PageShell";
import { LeaveRequestForm } from "@/components/features/leave/LeaveRequestForm";
import { SwapList } from "@/components/features/leave/SwapList";
import { SwapRequestForm } from "@/components/features/leave/SwapRequestForm";
import { Badge } from "@/components/ui/Badge";
import { Card, IconTile } from "@/components/ui/Card";
import { Hint, PageHeader, SectionBlock } from "@/components/ui/Section";
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

/** The page owns the tint and the gutter; every block inside is a Card. */
const PAGE = "flex flex-1 flex-col gap-3.5 bg-fill px-4 pb-6 pt-3.5";

export default async function LeavePage({ searchParams }: LeavePageProps) {
  const [{ locale, dict }, user, params] = await Promise.all([
    getTranslations(),
    requireSessionUser(),
    searchParams,
  ]);

  const weekStart = resolveWeekStart(params.week);
  const board = await getLeaveBoard(user, weekStart);
  const isAdmin = user.role === "admin";

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
    <PageShell width="data">
      <section className={PAGE}>
        <PageHeader
          variant="plain"
          title={dict.leave.title}
          subtitle={
            isAdmin && board.pendingLeaveCount > 0
              ? `${board.pendingLeaveCount} ${dict.summary.pendingSuffix}`
              : undefined
          }
        />

        {/*
          Balance, form and history are three separate blocks. The balance used to
          sit next to the submit button as small grey text, which read as a limit
          on it — and nothing in the product enforces one.
        */}
        {/*
          Balance and the form it informs, side by side from `lg`. The two
          `!isAdmin` blocks became one so they can share a row wrapper; the
          wrapper is `contents` below `lg`, so the phone still renders the same
          two children of this column, in the same order.
        */}
        {!isAdmin && (
          <div className="contents lg:flex lg:items-start lg:gap-3.5">
            <Card padding="md" className="lg:min-w-0 lg:basis-0 lg:grow-[5]">
              <div className="flex items-center gap-3">
                <IconTile name="hourglass" accent="amber" />
                <div className="min-w-0 flex-1">
                  <div className="label-eyebrow truncate">{dict.leave.balance}</div>
                  <div className="tabular text-3xl font-extrabold -tracking-[0.02em]">
                    {board.leaveBalance}{" "}
                    <span className="text-lg font-bold text-muted">{dict.units.days}</span>
                  </div>
                </div>
              </div>
              <Hint className="pt-2.5">{dict.leave.balanceHint}</Hint>
            </Card>

            {/* `LeaveRequestForm` owns no `className`, so the column lives on a
                wrapper rather than on a new prop. */}
            <div className="contents lg:block lg:min-w-0 lg:basis-0 lg:grow-[7]">
              <LeaveRequestForm
                dict={dict}
                defaultStart={addIsoDays(today, 7)}
                defaultEnd={addIsoDays(today, 8)}
              />
            </div>
          </div>
        )}

        {/*
          The two histories are the same kind of thing read the same way, so on
          a desk they are columns rather than one long scroll. Order is
          unchanged: requests first, swaps second, left to right.
        */}
        <div className="contents lg:flex lg:items-start lg:gap-3.5">
          <SectionBlock
            className="lg:min-w-0 lg:flex-1"
            title={dict.leave.requests}
            meta={
              board.pendingLeaveCount > 0 ? (
                <Badge tone="warning">
                  {board.pendingLeaveCount} {dict.summary.pendingSuffix}
                </Badge>
              ) : null
            }
          >
            <LeaveList rows={board.leaveRows} dict={dict} locale={locale} />
          </SectionBlock>

          <SectionBlock className="lg:min-w-0 lg:flex-1" title={dict.leave.swaps}>
            <SwapList rows={board.swapRows} dict={dict} locale={locale} />
          </SectionBlock>
        </div>

        {/* Two selects and a button: capped so the last block on the page does
            not run the full 1216px on its own. */}
        {!isAdmin && (
          <div className="contents lg:block lg:w-full lg:max-w-[34rem]">
            <SwapRequestForm
              dict={dict}
              shiftOptions={shiftOptions}
              colleagueOptions={colleagueOptions}
            />
          </div>
        )}
      </section>
    </PageShell>
  );
}
