"use client";

import Link from "next/link";
import { useState } from "react";

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
} from "./view-model";

export interface RosterBoardProps {
  view: "grid" | "person" | "day";
  canEdit: boolean;
  rows: RosterRowView[];
  columns: DayColumnView[];
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
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(year, month - 1, day);
  const weekday = labels.daysLong[(value.getDay() + 6) % 7];
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
        <GridView rows={rows} columns={columns} canEdit={canEdit} onOpen={openCell} />
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
  canEdit,
  onOpen,
}: {
  rows: RosterRowView[];
  columns: DayColumnView[];
  canEdit: boolean;
  onOpen: OpenCell;
}) {
  return (
    <div className="overflow-x-auto border-b border-line">
      <div className="min-w-117.5">
        <div className={cn(GRID_TEMPLATE, "border-b border-line")}>
          <div className="sticky left-0 z-2 border-r border-line bg-surface px-2.5 py-2 text-2xs font-bold tracking-[0.1em] text-muted">
          </div>
          {columns.map((column) => (
            <div
              key={column.date}
              className={cn(
                "border-r border-line px-1 py-1.75 text-center",
                column.isToday ? "bg-brand-soft" : "bg-surface",
              )}
            >
              <div className="text-2xs font-extrabold tracking-[0.06em]">
                {column.shortLabel}
              </div>
              <div className="tabular text-nano text-muted">{column.dayOfMonth}</div>
            </div>
          ))}
        </div>

        {rows.map((row) => (
          <div
            key={row.employeeId}
            className={cn(
              GRID_TEMPLATE,
              "items-stretch border-b border-line",
              row.isTaskRow ? "bg-surface-alt" : "bg-surface",
            )}
          >
            <div
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
              <div
                className={cn(
                  "tabular text-2xs",
                  row.overtime ? "text-warn-dark" : "text-muted",
                )}
              >
                {row.hoursLabel}
              </div>
            </div>

            {row.cells.map((cell) => {
              const content = (
                <>
                  <span className="text-xs font-medium leading-[1.1] mb-1">{cell.primary}</span>
                    <span className="text-xs font-medium leading-[1.1]">
                      {cell.secondary}
                    </span>
                </>
              );

              const className = cn(
                "tabular flex min-h-[42px] flex-col items-center justify-center gap-px border-r border-white",
                cellClass(cell, row.isTaskRow),
              );

              return canEdit ? (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => onOpen(row, cell)}
                  className={cn(className, "cursor-pointer")}
                >
                  {content}
                </button>
              ) : (
                <div key={cell.date} className={className}>
                  {content}
                </div>
              );
            })}
          </div>
        ))}
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
    <div className="border-b border-line">
      {rows.map((row) => (
        <div
          key={row.employeeId}
          className={cn("px-4 py-3.5", row.isTaskRow ? "bg-surface-alt" : "bg-surface")}
        >
          <div className="mb-[7px] flex items-baseline justify-between gap-2">
            <span
              className={cn(
                "truncate text-base font-bold",
                row.isTaskRow ? "text-muted" : "text-ink",
              )}
            >
              {row.name}
            </span>
            <span
              className={cn(
                "tabular flex-none text-xs font-bold",
                row.overtime ? "text-warn-dark" : "text-muted",
              )}
            >
              {row.hoursLabel}
            </span>
          </div>

          <div className="grid grid-cols-7 gap-[3px]">
            {row.cells.map((cell, index) => {
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
                "px-0.5 py-[5px] text-center",
                cellClass(cell, row.isTaskRow),
              );

              return canEdit ? (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => onOpen(row, cell)}
                  className={cn(className, "cursor-pointer")}
                >
                  {content}
                </button>
              ) : (
                <div key={cell.date} className={className}>
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
              "min-w-14 flex-1 border-r border-line px-1 py-2.5 text-center",
              column.index === selectedIndex
                ? "bg-ink text-white"
                : "bg-surface text-ink hover:bg-hover",
            )}
          >
            <div className="text-2xs font-extrabold tracking-[0.06em]">{column.shortLabel}</div>
            <div className="tabular text-sm font-semibold">{column.dayOfMonth}</div>
          </Link>
        ))}
      </div>

      <div className="flex justify-between bg-surface-alt px-4 pb-1 pt-2">
        {hourTicks.map((tick) => (
          <span key={tick} className="tabular text-nano font-bold text-muted-soft">
            {tick}
          </span>
        ))}
      </div>

      <div className="border-b border-line">
        {rows.length === 0 ? (
          <p className="px-4 py-4.5 text-sm text-muted-soft">{labels.emptyDay}</p>
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
                <div className="relative h-2.5 bg-hover">
                  <span
                    className={cn(
                      "absolute inset-y-0 block",
                      row.isTaskRow ? "bg-[#bab6b6]" : "bg-brand",
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
                className="w-full cursor-pointer px-4 py-2.5 text-left"
              >
                {body}
              </button>
            ) : (
              <div key={row.employeeId} className="px-4 py-2.5">
                {body}
              </div>
            );
          })
        )}

        <div className="px-4 pb-3.5 pt-3.5">
          <div className="label-eyebrow mb-1.5">{labels.offToday}</div>
          <div className="flex flex-wrap gap-1.5">
            {off.map((person) => (
              <span
                key={person.employeeId}
                className={cn(
                  "border border-dashed border-line-strong px-2.5 py-[5px] text-sm",
                  person.onLeave ? "bg-warn-soft text-warn-dark" : "bg-surface text-muted",
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
