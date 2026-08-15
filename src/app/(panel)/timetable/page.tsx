import { RosterBoard } from "@/components/features/timetable/RosterBoard";
import {
  buildDayColumns,
  buildDayRows,
  buildHourTicks,
  buildRosterRows,
} from "@/components/features/timetable/view-model";
import { Legend } from "@/components/ui/Legend";
import { PageHeader } from "@/components/ui/Section";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { todayIso, weekdayIndex } from "@/lib/date";
import { getTranslations } from "@/lib/i18n/server";
import { panelHref, ROUTES } from "@/lib/routes";
import { resolveDayIndex, resolveRosterView, resolveWeekStart } from "@/lib/week-params";
import { requireSessionUser } from "@/server/auth/session";
import { getRosterWeek } from "@/server/services/roster.service";

interface TimetablePageProps {
  searchParams: Promise<{ week?: string; view?: string; day?: string }>;
}

export default async function TimetablePage({ searchParams }: TimetablePageProps) {
  const [{ locale, dict }, user, params] = await Promise.all([
    getTranslations(),
    requireSessionUser(),
    searchParams,
  ]);

  const weekStart = resolveWeekStart(params.week);
  const view = resolveRosterView(params.view);
  const roster = await getRosterWeek(weekStart);

  const today = todayIso();
  const todayInWeek = roster.dates.includes(today) ? today : null;
  const dayIndex = resolveDayIndex(params.day, todayInWeek ? weekdayIndex(todayInWeek) : 0);

  const canEdit = user.role === "admin";
  const columns = buildDayColumns(roster.dates, dict, todayInWeek);
  const rows = buildRosterRows(roster.rows, dict, locale);
  const { onShift, off } = buildDayRows(roster.rows, roster.dates[dayIndex], dict, locale);

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
    panelHref(ROUTES.timetable, { week: weekStart, view: "day", day: String(index) }),
  );

  return (
    <section className="flex flex-1 flex-col">
      <PageHeader
        title={dict.timetable.title}
      />

      <SegmentedControl
        ariaLabel={dict.timetable.title}
        options={viewOptions}
        className="m-2"
      />

      <RosterBoard
        view={view}
        canEdit={canEdit}
        rows={rows}
        columns={columns}
        selectedDay={{ index: dayIndex, label: dict.calendar.daysLong[dayIndex] }}
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
          },
        }}
      />

      <Legend
        items={[
          { key: "working", swatchClass: "bg-brand", label: dict.timetable.legendWorking },
          { key: "leave", swatchClass: "bg-warn-soft", label: dict.timetable.legendLeave },
          { key: "off", swatchClass: "bg-fill", label: dict.timetable.legendOff },
          { key: "task", swatchClass: "bg-fill-strong", label: dict.timetable.legendTask },
        ]}
      />
    </section>
  );
}
