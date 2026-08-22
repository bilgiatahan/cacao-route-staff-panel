/**
 * Step 3: an off day is no longer represented by a low-contrast glyph alone.
 *
 * Before, an empty roster cell was a `·` in `text-disabled` — 1.66:1 on its own
 * background, with the state carried by colour and a speck of punctuation. Now
 * the glyph is an en dash at `text-muted` (5.18:1 on `bg-fill`) and every cell
 * also carries a `stateLabel`, which `RosterBoard` puts in the cell's accessible
 * name. Contrast and visual subordination were never in tension: the hierarchy
 * comes from the fill, not from making the text unreadable.
 *
 * These are pure-function tests. There is no DOM test harness in this project
 * and adding one is out of scope for this step, so the rendered `aria-label` is
 * verified by the presence of the `stateLabel` it is built from.
 */

import { describe, expect, it } from "vitest";

import { cellClass } from "@/components/features/timetable/cell-styles";
import { buildRosterRows } from "@/components/features/timetable/view-model";
import type { RosterCellView } from "@/components/features/timetable/view-model";
import type { ScheduleRow } from "@/lib/domain/schedule";
import { formatShiftSpanCompact } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import type { Employee, Shift } from "@/types/domain";

const MONDAY = "2026-08-03";
const TUESDAY = "2026-08-04";
const WEDNESDAY = "2026-08-05";

function employee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "emp-1",
    firstName: "Ayse",
    lastName: "Test",
    position: { tr: "Barista", en: "Barista" },
    hourlyRate: 130,
    contract: "part",
    birthDate: null,
    hiredAt: null,
    leaveBalance: 10,
    phone: "",
    email: "a@b.c",
    address: "",
    role: "staff",
    isTaskRow: false,
    archivedAt: null,
    ...overrides,
  };
}

const shift: Shift = {
  id: "shift-1",
  employeeId: "emp-1",
  date: MONDAY,
  startMinutes: 9 * 60,
  endMinutes: 17 * 60,
};

function row(overrides: Partial<ScheduleRow> = {}): ScheduleRow {
  return {
    employee: employee(),
    hours: 8,
    cells: [
      { date: MONDAY, shift, state: "shift" },
      { date: TUESDAY, shift: null, state: "leave" },
      { date: WEDNESDAY, shift: null, state: "off" },
    ],
    ...overrides,
  };
}

function cellOf(state: RosterCellView["state"]): RosterCellView {
  const rows = buildRosterRows([row()], getDictionary("tr"));
  const found = rows[0].cells.find((cell) => cell.state === state);
  if (!found) throw new Error(`no ${state} cell`);
  return found;
}

describe("off-day styling", () => {
  it("no longer uses the disabled token for the off state", () => {
    const off = cellClass(cellOf("off"), false);
    expect(off).not.toContain("text-disabled");
    expect(off).toContain("text-muted");
  });

  it("keeps a scheduled cell visually dominant", () => {
    // Subordination comes from the fill, which is why the off state can be
    // legible without competing.
    expect(cellClass(cellOf("shift"), false)).toContain("bg-brand");
    expect(cellClass(cellOf("shift"), false)).toContain("text-white");
    expect(cellClass(cellOf("off"), false)).toContain("bg-fill");
  });

  it("still distinguishes leave from off", () => {
    expect(cellClass(cellOf("leave"), false)).toContain("bg-warn-soft");
    expect(cellClass(cellOf("off"), false)).not.toContain("bg-warn-soft");
  });

  it("still distinguishes a task row from a person", () => {
    expect(cellClass(cellOf("shift"), true)).toContain("bg-fill-strong");
    expect(cellClass(cellOf("shift"), false)).toContain("bg-brand");
  });
});

describe("cell state is carried as text, not only as colour", () => {
  it("gives every cell a non-empty state label", () => {
    const rows = buildRosterRows([row()], getDictionary("tr"));
    for (const cell of rows[0].cells) {
      expect(cell.stateLabel, cell.state).toBeTruthy();
    }
  });

  it("labels a scheduled cell with its actual span", () => {
    expect(cellOf("shift").stateLabel).toBe("09:00–17:00");
  });

  it("labels leave and off distinctly, in the active locale", () => {
    for (const locale of ["tr", "en"] as const) {
      const dict = getDictionary(locale);
      const rows = buildRosterRows([row()], dict);
      const leave = rows[0].cells.find((c) => c.state === "leave")!;
      const off = rows[0].cells.find((c) => c.state === "off")!;

      expect(leave.stateLabel).toBe(dict.timetable.onLeave);
      expect(off.stateLabel).toBe(dict.timetable.legendOff);
      expect(leave.stateLabel).not.toBe(off.stateLabel);
    }
  });
});

describe("the off-day glyph", () => {
  it("is an en dash rather than a middot", () => {
    expect(cellOf("off").primary).toBe("–");
    expect(cellOf("off").compact).toBe("–");
  });

  it("is also an en dash in the compact span formatter", () => {
    expect(formatShiftSpanCompact(null)).toBe("–");
    expect(formatShiftSpanCompact(undefined)).toBe("–");
  });

  it("leaves a real span untouched", () => {
    expect(formatShiftSpanCompact(shift)).toBe("9–17");
  });

  it("still shows the localised leave marker on a leave cell", () => {
    const dict = getDictionary("tr");
    expect(cellOf("leave").primary).toBe(dict.timetable.leaveShort);
  });
});
