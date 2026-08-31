import { PageShell } from "@/components/layout/PageShell";
import { PeriodSwitcher } from "@/components/layout/PeriodSwitcher";
import { buildWeekPicker } from "@/components/layout/period-options";
import { CopyWeekButton } from "@/components/features/timetable/CopyWeekButton";
import { RosterBoard } from "@/components/features/timetable/RosterBoard";
import {
  buildDayColumns,
  buildDayRows,
  buildHourTicks,
  buildRosterRows,
} from "@/components/features/timetable/view-model";
import { Card } from "@/components/ui/Card";
import { Legend } from "@/components/ui/Legend";
import { PageHeader } from "@/components/ui/Section";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { addIsoDays, todayIso, weekdayIndex } from "@/lib/date";
import { formatWeekLabel } from "@/lib/format";
import { interpolate } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";
import { panelHref, ROUTES } from "@/lib/routes";
import {
  resolveDayIndex,
  resolveRosterView,
  resolveWeekStart,
} from "@/lib/week-params";
import { actionErrorMessages } from "@/server/actions/action-result";
import { requireSessionUser } from "@/server/auth/session";
import {
  getPreviousWeekPreview,
  getRosterWeek,
} from "@/server/services/roster.service";

interface TimetablePageProps {
  searchParams: Promise<{ week?: string; view?: string; day?: string }>;
}

export default async function TimetablePage({
  searchParams,
}: TimetablePageProps) {
  const [{ dict }, user, params] = await Promise.all([
    getTranslations(),
    requireSessionUser(),
    searchParams,
  ]);

  const weekStart = resolveWeekStart(params.week);
  const view = resolveRosterView(params.view);
  const roster = await getRosterWeek(weekStart);

  const today = todayIso();
  const todayInWeek = roster.dates.includes(today) ? today : null;
  const dayIndex = resolveDayIndex(
    params.day,
    todayInWeek ? weekdayIndex(todayInWeek) : 0,
  );

  const canEdit = user.role === "admin";
  // Only an admin can copy a week, so only an admin pays for the extra read of
  // last week's shifts.
  const copyPreview = canEdit ? await getPreviousWeekPreview(roster) : null;
  const columns = buildDayColumns(roster.dates, dict, todayInWeek);
  const rows = buildRosterRows(roster.rows, dict);
  const { onShift, off } = buildDayRows(roster.rows, roster.dates[dayIndex], dict);

  const viewOptions = (["grid", "person", "day"] as const).map((key) => ({
    key,
    label:
      key === "grid"
        ? dict.timetable.viewGrid
        : key === "person"
          ? dict.timetable.viewPerson
          : dict.timetable.viewDay,
    href: panelHref(ROUTES.timetable, {
      week: weekStart,
      view: key,
      day: key === "day" ? String(dayIndex) : undefined,
    }),
    active: view === key,
  }));

  const dayHrefs = roster.dates.map((_, index) =>
    panelHref(ROUTES.timetable, {
      week: weekStart,
      view: "day",
      day: String(index),
    }),
  );

  // Stepping a week keeps the current view and day, so the roster you were
  // reading is the one you land on.
  const weekHref = (offsetWeeks: number) =>
    panelHref(ROUTES.timetable, {
      week: addIsoDays(weekStart, offsetWeeks * 7),
      view,
      day: view === "day" ? String(dayIndex) : undefined,
    });

  // The picker jumps with the same builder the arrows step with, so a jump
  // keeps the view and the day exactly as a step does.
  const weekPicker = buildWeekPicker(weekStart, weekHref, dict);

  return (
    // The one screen that needs the wide shell: seven day columns do not belong
    // in a 560px column when 960px is available.
    <PageShell width="wide">
      <section className="flex flex-1 flex-col gap-3.5 bg-fill px-4 pb-6 pt-3.5">
        <PageHeader
          variant="plain"
          title={dict.timetable.title}
          action={
            <PeriodSwitcher
              previousHref={weekHref(-1)}
              nextHref={weekHref(1)}
              label={formatWeekLabel(weekStart, dict)}
              previousLabel={dict.calendar.previousWeek}
              nextLabel={dict.calendar.nextWeek}
              ariaLabel={dict.calendar.thisWeek}
              picker={weekPicker}
            />
          }
        />

        {/*
          The view switch and the copy control share a row on a desk and stack on
          a phone, where a 44px button beside a three-way switch would leave both
          too narrow to hit.
        */}
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <SegmentedControl
            ariaLabel={dict.timetable.title}
            options={viewOptions}
          />

          {copyPreview ? (
            <CopyWeekButton
              weekStart={weekStart}
              canCopy={copyPreview.sourceCount > 0}
              labels={{
                action: dict.timetable.copy,
                confirm: dict.timetable.copyShort,
                pending: dict.timetable.copying,
                title: dict.timetable.copyTitle,
                // Built here rather than in the client: the counts are server
                // facts, and the dictionary never crosses the boundary.
                body: `${dict.timetable.copyQuestion} ${interpolate(
                  copyPreview.targetCount > 0
                    ? dict.timetable.copyReplaces
                    : dict.timetable.copyAdds,
                  {
                    n: String(copyPreview.sourceCount),
                    m: String(copyPreview.targetCount),
                  },
                )}`,
                cancel: dict.common.cancel,
                close: dict.common.close,
                done: dict.timetable.copyDone,
                empty: dict.timetable.copyEmpty,
                errorMessages: actionErrorMessages(dict),
              }}
            />
          ) : null}
        </div>

        <Card className="overflow-hidden">
          <RosterBoard
            view={view}
            canEdit={canEdit}
            rows={rows}
            columns={columns}
            selectedDay={{
              index: dayIndex,
              label: dict.calendar.daysLong[dayIndex],
            }}
            dayRows={onShift}
            dayOff={off}
            hourTicks={buildHourTicks()}
            dayHrefs={dayHrefs}
            labels={{
              staffColumn: dict.timetable.staffColumn,
              offToday: dict.timetable.offToday,
              emptyDay: dict.timetable.emptyDay,
              daysLong: dict.calendar.daysLong,
              monthNames: dict.calendar.months,
              editor: {
                in: dict.timetable.in,
                out: dict.timetable.out,
                hint: dict.timetable.editorHint,
                save: dict.common.save,
                saving: dict.common.saving,
                clear: dict.common.clear,
                close: dict.common.close,
                invalid: dict.timetable.editorInvalid,
                errorMessages: actionErrorMessages(dict),
              },
            }}
          />
        </Card>

        <Legend
          items={[
            {
              key: "working",
              swatchClass: "bg-brand",
              label: dict.timetable.legendWorking,
            },
            {
              key: "leave",
              swatchClass: "bg-warn-soft",
              label: dict.timetable.legendLeave,
            },
            {
              key: "off",
              swatchClass: "bg-fill",
              label: dict.timetable.legendOff,
            },
            {
              key: "task",
              swatchClass: "bg-fill-strong",
              label: dict.timetable.legendTask,
            },
          ]}
        />
      </section>
    </PageShell>
  );
}
