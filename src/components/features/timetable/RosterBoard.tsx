"use client";

import Link from "next/link";
import { useState } from "react";

import { fromIsoDate, weekdayIndex } from "@/lib/date";
import { EmptyState } from "@/components/ui/Section";
import { cn } from "@/lib/utils";

import { cellClass } from "./cell-styles";
import {
  ShiftEditorSheet,
  type ShiftEditorLabels,
  type ShiftEditorTarget,
} from "./ShiftEditorSheet";
import type {
  DayColumnView,
  DayOffView,
  DayRowView,
  RosterCellView,
  RosterRowView,
  RosterTotalsView,
} from "./view-model";

export interface RosterBoardProps {
  view: "grid" | "person" | "day";
  canEdit: boolean;
  rows: RosterRowView[];
  columns: DayColumnView[];
  /** Grid view only: the column and week hour totals printed under the rows. */
  totals: RosterTotalsView;
  /** Day view only. */
  selectedDay: { index: number; label: string } | null;
  dayRows: DayRowView[];
  dayOff: DayOffView[];
  hourTicks: string[];
  /** Pre-built `?day=` links so day selection stays server-rendered. */
  dayHrefs: string[];
  labels: {
    staffColumn: string;
    offToday: string;
    emptyDay: string;
    editor: ShiftEditorLabels;
    /** Long weekday names, Monday-first, for the editor subtitle. */
    daysLong: string[];
    monthNames: string[];
  };
}

function dayLabelFor(date: string, labels: RosterBoardProps["labels"]): string {
  const value = fromIsoDate(date);
  const weekday = labels.daysLong[weekdayIndex(date)];
  return `${weekday} ${value.getDate()} ${labels.monthNames[value.getMonth()]}`;
}

/**
 * All three roster views plus the shift editor. The data arrives fully
 * formatted from the server, so this component only handles interaction.
 */
export function RosterBoard({
  view,
  canEdit,
  rows,
  columns,
  totals,
  selectedDay,
  dayRows,
  dayOff,
  hourTicks,
  dayHrefs,
  labels,
}: RosterBoardProps) {
  const [target, setTarget] = useState<ShiftEditorTarget | null>(null);

  const openCell = (
    row: Pick<RosterRowView, "employeeId" | "name">,
    cell: Pick<RosterCellView, "date" | "startTime" | "endTime" | "state">,
  ) => {
    if (!canEdit) return;
    setTarget({
      employeeId: row.employeeId,
      employeeName: row.name.replace(/ ·$/, ""),
      date: cell.date,
      dayLabel: dayLabelFor(cell.date, labels),
      startTime: cell.startTime,
      endTime: cell.endTime,
      hasShift: cell.state === "shift",
    });
  };

  return (
    <>
      {view === "grid" ? (
        <GridView
          rows={rows}
          columns={columns}
          totals={totals}
          canEdit={canEdit}
          staffColumn={labels.staffColumn}
          onOpen={openCell}
        />
      ) : null}

      {view === "person" ? (
        <PersonView rows={rows} columns={columns} canEdit={canEdit} onOpen={openCell} />
      ) : null}

      {view === "day" ? (
        <DayView
          columns={columns}
          dayHrefs={dayHrefs}
          selectedIndex={selectedDay?.index ?? 0}
          rows={dayRows}
          off={dayOff}
          hourTicks={hourTicks}
          canEdit={canEdit}
          labels={labels}
          onOpen={openCell}
        />
      ) : null}

      <ShiftEditorSheet
        target={target}
        labels={labels.editor}
        onClose={() => setTarget(null)}
      />
    </>
  );
}

type OpenCell = (
  row: Pick<RosterRowView, "employeeId" | "name">,
  cell: Pick<RosterCellView, "date" | "startTime" | "endTime" | "state">,
) => void;

const GRID_TEMPLATE = "grid grid-cols-[96px_repeat(7,minmax(52px,1fr))]";

function GridView({
  rows,
  columns,
  totals,
  canEdit,
  staffColumn,
  onOpen,
}: {
  rows: RosterRowView[];
  columns: DayColumnView[];
  totals: RosterTotalsView;
  canEdit: boolean;
  /** Names the grid and its first column; the prop existed but was never used. */
  staffColumn: string;
  onOpen: OpenCell;
}) {
  return (
    // Horizontal scroll only where the data needs it: at 960px the seven columns
    // fit, on a phone they cannot, and shrinking the type to force it would cost
    // more than a scroll does.
    <div className="overflow-x-auto">
      {/*
        ARIA grid roles over the existing CSS grid: the layout is untouched, but
        a screen reader can now navigate by row and column instead of meeting a
        flat run of labelled cells.
      */}
      <div
        role="grid"
        aria-label={staffColumn}
        aria-rowcount={rows.length + 2}
        aria-colcount={columns.length + 1}
        className="min-w-117.5"
      >
        <div role="row" className={cn(GRID_TEMPLATE, "border-b border-line")}>
          <div
            role="columnheader"
            className="sticky left-0 z-2 border-r border-line bg-surface px-2.5 py-2 text-2xs font-bold tracking-[0.1em] text-muted"
          >
            {/* The label existed as a prop and was never rendered. */}
            <span className="sr-only">{staffColumn}</span>
          </div>
          {columns.map((column) => (
            <div
              key={column.date}
              role="columnheader"
              className={cn(
                "border-r border-line px-1 py-1.75 text-center",
                column.isToday ? "bg-brand-soft" : "bg-surface",
              )}
            >
              <div className="text-2xs font-extrabold tracking-[0.06em]">
                {column.shortLabel}
              </div>
              <div className="tabular text-nano text-muted">{column.dateLabel}</div>
            </div>
          ))}
        </div>

        {rows.map((row) => (
          <div
            key={row.employeeId}
            role="row"
            className={cn(
              GRID_TEMPLATE,
              "items-stretch border-b border-line",
              row.isTaskRow ? "bg-surface-alt" : "bg-surface",
            )}
          >
            <div
              role="rowheader"
              className={cn(
                "sticky left-0 z-1 min-w-0 border-r border-line px-2.5 py-1.5",
                row.isTaskRow ? "bg-surface-alt" : "bg-surface",
              )}
            >
              <div
                className={cn(
                  "truncate text-sm font-bold",
                  row.isTaskRow ? "text-muted" : "text-ink",
                )}
              >
                {row.name}
              </div>
              <div className="tabular text-2xs text-muted">{row.hoursLabel}</div>
            </div>

            {row.cells.map((cell) => {
              // The dash and the fill are visual; the name is what gets read.
              const cellLabel = `${row.name} · ${cell.date} · ${cell.stateLabel}`;
              const content = (
                <>
                  <span className="text-xs font-medium leading-[1.1] mb-1">{cell.primary}</span>
                    <span className="text-xs font-medium leading-[1.1]">
                      {cell.secondary}
                    </span>
                </>
              );

              const className = cn(
                "tabular flex min-h-11 flex-col items-center justify-center gap-px border-r border-white",
                cellClass(cell, row.isTaskRow),
              );

              return canEdit ? (
                // `display: contents` lets the wrapper be the gridcell while the
                // button stays the grid item — so the cell keeps its button role
                // and the "press to edit" affordance is not traded away for it.
                <div key={cell.date} role="gridcell" className="contents">
                  <button
                    type="button"
                    aria-label={cellLabel}
                    onClick={() => onOpen(row, cell)}
                    // An editable cell says so on hover and focus, not by colour.
                    className={cn(
                      className,
                      "cursor-pointer ring-inset hover:ring-2 hover:ring-ink/25",
                      "focus-visible:outline-offset-[-2px]",
                    )}
                  >
                    {content}
                  </button>
                </div>
              ) : (
                <div
                  key={cell.date}
                  role="gridcell"
                  aria-label={cellLabel}
                  className={className}
                >
                  {content}
                </div>
              );
            })}
          </div>
        ))}

        {/*
          The totals close the table rather than float above it: you read the
          week down the columns and meet the sum where the columns end.
        */}
        <div
          role="row"
          className={cn(GRID_TEMPLATE, "items-stretch bg-surface-alt border-t border-line-strong")}
        >
          <div
            role="rowheader"
            className="sticky left-0 z-1 min-w-0 border-r border-line bg-surface-alt px-2.5 py-1.5"
          >
            <div className="truncate text-2xs font-bold tracking-[0.06em] text-muted">
              {totals.label}
            </div>
            <div className="tabular text-sm font-bold text-ink">{totals.totalLabel}</div>
          </div>

          {totals.days.map((day) => (
            <div
              key={day.date}
              role="gridcell"
              // The dash is a shape; the hours are what gets read out.
              aria-label={day.ariaLabel}
              className={cn(
                "tabular flex min-h-11 items-center justify-center border-r border-line text-xs font-bold",
                day.isEmpty ? "text-muted" : "text-ink",
              )}
            >
              {day.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PersonView({
  rows,
  columns,
  canEdit,
  onOpen,
}: {
  rows: RosterRowView[];
  columns: DayColumnView[];
  canEdit: boolean;
  onOpen: OpenCell;
}) {
  return (
    <div>
      {rows.map((row) => (
        <div
          key={row.employeeId}
          className={cn(
            "border-b border-line px-3.5 py-3 last:border-b-0",
            row.isTaskRow ? "bg-surface-alt" : "bg-surface",
          )}
        >
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span
              className={cn(
                "truncate text-base font-bold",
                row.isTaskRow ? "text-muted" : "text-ink",
              )}
            >
              {row.name}
            </span>
            <span className="tabular flex-none text-xs font-bold text-muted">
              {row.hoursLabel}
            </span>
          </div>

          <div className="grid grid-cols-7 gap-[3px]">
            {row.cells.map((cell, index) => {
              const cellLabel = `${row.name} · ${cell.date} · ${cell.stateLabel}`;
              const content = (
                <>
                  <span className="text-micro font-bold tracking-[0.04em] opacity-70">
                    {columns[index]?.shortLabel.slice(0, 2)}
                  </span>
                  <span className="tabular block text-2xs font-bold leading-[1.3]">
                    {cell.compact}
                  </span>
                </>
              );

              const className = cn(
                "rounded-sm px-0.5 py-1.5 text-center",
                cellClass(cell, row.isTaskRow),
              );

              return canEdit ? (
                <button
                  key={cell.date}
                  type="button"
                  aria-label={cellLabel}
                  onClick={() => onOpen(row, cell)}
                  className={cn(
                    className,
                    "cursor-pointer ring-inset hover:ring-2 hover:ring-ink/25",
                  )}
                >
                  {content}
                </button>
              ) : (
                <div key={cell.date} role="img" aria-label={cellLabel} className={className}>
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function DayView({
  columns,
  dayHrefs,
  selectedIndex,
  rows,
  off,
  hourTicks,
  canEdit,
  labels,
  onOpen,
}: {
  columns: DayColumnView[];
  dayHrefs: string[];
  selectedIndex: number;
  rows: DayRowView[];
  off: DayOffView[];
  hourTicks: string[];
  canEdit: boolean;
  labels: RosterBoardProps["labels"];
  onOpen: OpenCell;
}) {
  return (
    <>
      <div className="flex overflow-x-auto">
        {columns.map((column) => (
          <Link
            key={column.date}
            href={dayHrefs[column.index]}
            aria-current={column.index === selectedIndex ? "true" : undefined}
            className={cn(
              "min-w-14 flex-1 border-r border-line px-1 py-2.5 text-center last:border-r-0",
              "focus-visible:outline-offset-[-3px]",
              column.index === selectedIndex
                ? "bg-brand font-extrabold text-white"
                : "bg-surface text-muted hover:bg-hover hover:text-ink",
            )}
          >
            <div className="text-2xs font-extrabold tracking-[0.06em]">{column.shortLabel}</div>
            <div className="tabular text-sm font-semibold">{column.dayOfMonth}</div>
          </Link>
        ))}
      </div>

      <div className="flex justify-between border-b border-line bg-fill px-3.5 pb-1 pt-2">
        {hourTicks.map((tick) => (
          <span key={tick} className="tabular text-nano font-bold text-muted">
            {tick}
          </span>
        ))}
      </div>

      <div>
        {rows.length === 0 ? (
          <EmptyState>{labels.emptyDay}</EmptyState>
        ) : (
          rows.map((row) => {
            const body = (
              <>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-base font-semibold">{row.name}</span>
                  <span
                    className={cn(
                      "tabular text-xs font-bold",
                      row.isTaskRow ? "text-muted" : "text-brand-dark",
                    )}
                  >
                    {row.spanLabel}
                  </span>
                </div>
                <div className="relative h-2.5 rounded-sm bg-fill-strong">
                  <span
                    className={cn(
                      "absolute inset-y-0 block rounded-sm",
                      row.isTaskRow ? "bg-disabled" : "bg-brand",
                    )}
                    style={{ left: `${row.leftPercent}%`, width: `${row.widthPercent}%` }}
                  />
                </div>
              </>
            );

            return canEdit ? (
              <button
                key={row.employeeId}
                type="button"
                onClick={() =>
                  onOpen(
                    { employeeId: row.employeeId, name: row.name },
                    {
                      date: row.date,
                      startTime: row.startTime,
                      endTime: row.endTime,
                      state: "shift",
                    },
                  )
                }
                className="w-full cursor-pointer px-3.5 py-2.5 text-left hover:bg-hover"
              >
                {body}
              </button>
            ) : (
              <div key={row.employeeId} className="px-3.5 py-2.5">
                {body}
              </div>
            );
          })
        )}

        <div className="border-t border-line px-3.5 pb-3.5 pt-3.5">
          <div className="label-eyebrow mb-1.5">{labels.offToday}</div>
          <div className="flex flex-wrap gap-1.5">
            {off.map((person) => (
              <span
                key={person.employeeId}
                className={cn(
                  "rounded-sm border border-line-strong px-2.5 py-1 text-sm",
                  person.onLeave ? "bg-warn-soft text-warn-dark" : "bg-fill text-muted",
                )}
              >
                {person.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
