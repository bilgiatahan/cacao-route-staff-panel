/**
 * The monthly report's presentation layer.
 *
 * Two things are worth testing without a DOM, and this project has no DOM
 * harness anyway:
 *
 *   1. **Chart geometry.** A bar chart is arithmetic before it is a picture, and
 *      the arithmetic has genuinely awkward cases — an all-zero month, a single
 *      slice that would sweep a full circle and render as nothing, a value so
 *      small its bar disappears.
 *   2. **Labelling.** Every string on the page is produced on the server, so the
 *      mistakes that actually reach a reader — "-0.0%", a dash where a zero
 *      belongs, a boundary week claiming days it did not count — are catchable
 *      here.
 *
 * No business figure is recomputed in either layer, so these assert formatting
 * and shape, never the money itself.
 */

import { describe, expect, it, vi } from "vitest";

import {
  barGeometry,
  DONUT,
  donutSlices,
  EMPTY_BAR_PERCENT,
  referencePercent,
} from "@/components/features/reports/chart-geometry";
import {
  buildChartBars,
  buildComparisonRows,
  buildDonutSlices,
  buildStatCards,
  buildWeekRows,
  buildWeekSegments,
  resolveSelectedWeekIndex,
  selectedWeekLabel,
  selectedWeekPartialNotice,
  weekShortLabel,
  weeksWithDataLabel,
} from "@/components/features/reports/view-model";
import {
  buildMonthlyCostReport,
  compareWithPreviousMonth,
} from "@/lib/domain/monthly-cost";
import { formatSignedHours, formatSignedMoney, formatSignedPercent } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import type { Employee, IsoDate, Shift } from "@/types/domain";

const AUGUST = "2026-08";
const dict = getDictionary("en");
const tr = getDictionary("tr");

function employee(id: string, overrides: Partial<Employee> = {}): Employee {
  return {
    id,
    firstName: id,
    lastName: "Test",
    position: { tr: "Barista", en: "Barista" },
    hourlyRate: 10,
    contract: "part",
    birthDate: null,
    hiredAt: null,
    leaveBalance: 0,
    phone: "",
    email: "",
    address: "",
    role: "staff",
    isTaskRow: false,
    archivedAt: null,
    ...overrides,
  };
}

function shift(employeeId: string, date: IsoDate, startHour = 9, endHour = 17): Shift {
  return {
    id: `shift-${employeeId}-${date}`,
    employeeId,
    date,
    startMinutes: startHour * 60,
    endMinutes: endHour * 60,
  };
}

const ME = "emp-me";
const YOU = "emp-you";

/** Weeks 2, 3 and 4 carry data; the two boundary weeks and week 5 are empty. */
const report = buildMonthlyCostReport(
  AUGUST,
  [employee(ME), employee(YOU, { hourlyRate: 20, position: { tr: "Kasiyer", en: "Cashier" } })],
  [
    shift(ME, "2026-08-03"),
    shift(ME, "2026-08-04"),
    shift(YOU, "2026-08-05"),
    shift(ME, "2026-08-10"),
    shift(ME, "2026-08-17"),
  ],
);

const empty = buildMonthlyCostReport(AUGUST, [employee(ME)], []);

/* --------------------------------------------------------- bar arithmetic -- */

describe("barGeometry", () => {
  it("scales against the tallest bar", () => {
    const bars = barGeometry([100, 50, 25]);

    expect(bars[0].heightPercent).toBe(100);
    expect(bars[1].heightPercent).toBe(50);
    expect(bars[2].heightPercent).toBe(25);
  });

  it("starts the domain at zero rather than at the smallest value", () => {
    // Three nearly identical figures must look nearly identical. A floating
    // baseline would render 99 as a sliver next to 101.
    const bars = barGeometry([99, 100, 101]);

    for (const bar of bars) {
      expect(bar.heightPercent).toBeGreaterThan(95);
    }
  });

  it("keeps a zero bar visible as an empty one", () => {
    const bars = barGeometry([100, 0]);

    expect(bars[1].heightPercent).toBe(EMPTY_BAR_PERCENT);
    expect(bars[1].heightPercent).toBeGreaterThan(0);
  });

  it("draws an all-zero month as a flat row rather than dividing by zero", () => {
    const bars = barGeometry([0, 0, 0]);

    for (const bar of bars) {
      expect(bar.heightPercent).toBe(EMPTY_BAR_PERCENT);
      expect(Number.isFinite(bar.heightPercent)).toBe(true);
    }
  });

  it("never lets a tiny value vanish entirely", () => {
    const bars = barGeometry([10_000, 1]);

    expect(bars[1].heightPercent).toBeGreaterThanOrEqual(EMPTY_BAR_PERCENT);
  });

  it("marks the selected bar and only that one", () => {
    const bars = barGeometry([1, 2, 3], 1);

    expect(bars.map((bar) => bar.isSelected)).toEqual([false, true, false]);
  });

  it("marks nothing when the selection is out of range", () => {
    expect(barGeometry([1, 2], -1).some((bar) => bar.isSelected)).toBe(false);
  });

  it("handles an empty series", () => {
    expect(barGeometry([])).toEqual([]);
  });
});

describe("referencePercent", () => {
  it("places the average within the same domain as the bars", () => {
    expect(referencePercent(50, [100, 50])).toBe(50);
  });

  it("has nowhere to sit when everything is zero", () => {
    expect(referencePercent(0, [0, 0])).toBeNull();
    expect(referencePercent(10, [0, 0])).toBeNull();
  });

  it("never escapes the plot", () => {
    expect(referencePercent(500, [100])).toBe(100);
  });
});

/* ------------------------------------------------------- donut arithmetic -- */

describe("donutSlices", () => {
  it("gives one arc per value", () => {
    const slices = donutSlices([50, 30, 20]);

    expect(slices).toHaveLength(3);
    expect(slices.map((slice) => Math.round(slice.percent))).toEqual([50, 30, 20]);
  });

  it("has shares that sum to 100", () => {
    const total = donutSlices([1910, 1816.5, 1110, 861]).reduce(
      (sum, slice) => sum + slice.percent,
      0,
    );
    expect(total).toBeCloseTo(100, 10);
  });

  it("draws a sole slice as a near-complete ring rather than nothing", () => {
    // A 360° arc starts and ends at the same point, which renders as empty.
    const [only] = donutSlices([100]);

    expect(only.path).not.toBe("");
    expect(only.percent).toBe(100);
    expect(only.path).toMatch(/^M [\d.]+ [\d.]+ A /);
  });

  it("produces no slices at all when nothing was spent", () => {
    // The component draws the bare track instead — a full circle of one colour
    // would read as "one person took everything".
    expect(donutSlices([])).toEqual([]);
    expect(donutSlices([0, 0])).toEqual([]);
  });

  it("gives a zero value an empty path rather than a zero-length arc", () => {
    const slices = donutSlices([100, 0]);

    expect(slices[1].path).toBe("");
    expect(slices[1].percent).toBe(0);
  });

  it("ignores a negative value rather than sweeping backwards", () => {
    const slices = donutSlices([100, -50]);

    expect(slices[0].percent).toBe(100);
    expect(slices[1].percent).toBe(0);
  });

  it("keeps every coordinate inside the viewBox", () => {
    for (const slice of donutSlices([30, 25, 20, 15, 10])) {
      for (const value of slice.path.match(/[\d.]+/g) ?? []) {
        expect(Number(value)).toBeGreaterThanOrEqual(0);
        expect(Number(value)).toBeLessThanOrEqual(DONUT.size);
      }
    }
  });

  it("keeps the ring inside its own box", () => {
    expect(DONUT.center + DONUT.radius + DONUT.thickness / 2).toBeLessThanOrEqual(
      DONUT.size,
    );
  });
});

/* ------------------------------------------------------- signed formatting -- */

describe("signed formatting", () => {
  it("signs a percentage both ways", () => {
    expect(formatSignedPercent(12.44, dict)).toBe("+12.4%");
    expect(formatSignedPercent(-5.67, dict)).toBe("-5.7%");
  });

  it("shows a dash rather than a fabricated percentage", () => {
    expect(formatSignedPercent(null, dict)).toBe(dict.common.dash);
  });

  it("never renders a negative zero", () => {
    // -0.04 rounds to -0.0, which reads as a fall that did not happen.
    expect(formatSignedPercent(-0.04, dict)).toBe("0.0%");
    expect(formatSignedPercent(0, dict)).toBe("0.0%");
  });

  it("signs money and hours", () => {
    expect(formatSignedMoney(343.75)).toBe("+£343.75");
    expect(formatSignedMoney(-1534.25)).toBe("-£1,534.25");
    expect(formatSignedMoney(0)).toBe("£0.00");
    expect(formatSignedHours(34, dict)).toBe(`+34${dict.units.hourSuffix}`);
    expect(formatSignedHours(-10, dict)).toBe(`-10${dict.units.hourSuffix}`);
  });
});

/* --------------------------------------------------------- week selection -- */

describe("resolveSelectedWeekIndex", () => {
  it("honours an explicit week", () => {
    expect(resolveSelectedWeekIndex(report, "2026-08-17")).toBe(3);
    expect(resolveSelectedWeekIndex(report, "2026-07-27")).toBe(0);
  });

  it("falls back to the last week with data for an unrelated month", () => {
    // Today is not inside August 2026 for most of this suite's lifetime, so the
    // most recent week that carried shifts is the useful landing place.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 0, 15));
    try {
      expect(resolveSelectedWeekIndex(report, undefined)).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("prefers the week containing today when the report is the current month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12)); // 12 August 2026 → week 3 (10–16)
    try {
      expect(resolveSelectedWeekIndex(report, undefined)).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("lands on the first week when nothing has data at all", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 0, 15));
    try {
      expect(resolveSelectedWeekIndex(empty, undefined)).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores a week that is not in this month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 0, 15));
    try {
      expect(resolveSelectedWeekIndex(report, "2026-03-02")).toBe(3);
      expect(resolveSelectedWeekIndex(report, "nonsense")).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });
});

/* ------------------------------------------------------------- stat cards -- */

describe("stat cards", () => {
  it("emits the four metrics in order", () => {
    expect(buildStatCards(report, dict).map((card) => card.key)).toEqual([
      "cost",
      "hours",
      "rate",
      "staff",
    ]);
  });

  it("formats the month's figures", () => {
    const [cost, hours, rate] = buildStatCards(report, dict);

    // 32h at £10 plus 8h at £20 = £480 over 40h.
    expect(cost.value).toBe("£480.00");
    expect(hours.value).toBe(`40${dict.units.hourSuffix}`);
    expect(rate.value).toBe(`£12.00${dict.units.perHour}`);
  });

  it("says there is no baseline rather than inventing one", () => {
    for (const card of buildStatCards(report, dict)) {
      expect(card.delta).toBeNull();
      expect(card.comparison).toBe(dict.reports.noPrevious);
    }
  });

  it("names the previous month once a comparison is attached", () => {
    const july = buildMonthlyCostReport("2026-07", [employee(ME)], [
      shift(ME, "2026-07-06"),
    ]);
    const cards = buildStatCards(compareWithPreviousMonth(report, july), dict);

    // July: 8h at £10 = £80. August: £480. A five-fold rise.
    expect(cards[0].comparison).toBe("Jul 2026: £80.00");
    expect(cards[0].delta).toEqual({ absolute: 400, percent: 500 });
    expect(cards[1].comparison).toBe(`Jul 2026: 8${dict.units.hourSuffix}`);
  });

  it("does not paint a rising wage bill as good news", () => {
    const cards = buildStatCards(report, dict);

    // Cost and the blended rate are both better lower; hours and headcount are
    // volumes with no verdict attached.
    expect(cards[0].sentiment).toBe("lowerIsBetter");
    expect(cards[1].sentiment).toBe("neutral");
    expect(cards[2].sentiment).toBe("lowerIsBetter");
    expect(cards[3].sentiment).toBe("neutral");
  });

  it("dashes the hourly rate for a month with no hours", () => {
    const cards = buildStatCards(empty, dict);

    expect(cards[2].value).toBe(dict.common.dash);
    expect(cards[0].value).toBe("£0.00");
  });
});

/* ---------------------------------------------------------- weeks and bars -- */

describe("weekly labels", () => {
  it("numbers the weeks from one, in each locale", () => {
    expect(weekShortLabel(0, dict)).toBe("W1");
    expect(weekShortLabel(5, dict)).toBe("W6");
    expect(weekShortLabel(0, tr)).toBe("H1");
  });

  it("labels a bar by its real Monday–Sunday span, not its clipped one", () => {
    const bars = buildChartBars(report, dict);

    expect(bars).toHaveLength(6);
    // The week belongs to July and reads as itself, even in an August report.
    expect(bars[0].rangeLabel).toBe("27 Jul – 2 Aug");
    expect(bars[5].rangeLabel).toBe("31 Aug – 6 Sep");
    // An interior week sits inside one month, so it names it once.
    expect(bars[2].rangeLabel).toBe("10–16 Aug");
  });

  it("says in words what a bar's height cannot", () => {
    const bars = buildChartBars(report, dict);

    expect(bars[1].ariaLabel).toContain("W2");
    // Week 2: 16h at £10 plus 8h at £20 = £320 over 24h.
    expect(bars[1].ariaLabel).toContain("£320.00");
    expect(bars[1].ariaLabel).toContain(dict.reports.partialFull);
    // The boundary week states how much of it actually counted.
    expect(bars[0].ariaLabel).toContain(`2 ${dict.reports.partialDays}`);
    // One day takes the singular in English, the same word in Turkish.
    expect(bars[5].ariaLabel).toContain(`1 ${dict.reports.partialDay}`);
    expect(bars[5].ariaLabel).not.toContain("1 days");
  });

  it("carries the month and the week in every link", () => {
    for (const bar of buildChartBars(report, dict)) {
      expect(bar.href).toBe(`/reports?week=${bar.key}&month=${AUGUST}`);
    }
  });

  it("marks exactly one row and one segment as selected", () => {
    const rows = buildWeekRows(report, dict, 2);
    const segments = buildWeekSegments(report, dict, 2);

    expect(rows.filter((row) => row.isSelected)).toHaveLength(1);
    expect(rows[2].isSelected).toBe(true);
    expect(segments.filter((segment) => segment.active)).toHaveLength(1);
  });

  it("dashes a week's hourly rate when it had no hours", () => {
    const rows = buildWeekRows(report, dict, 0);

    expect(rows[0].hoursLabel).toBe(`0${dict.units.hourSuffix}`);
    expect(rows[0].rateLabel).toBe(dict.common.dash);
    // Week 2 blends £10 and £20: £320 over 24h.
    expect(rows[1].rateLabel).toBe("£13.33");
  });

  it("names the selected week and whether it is clipped", () => {
    // A week inside one month names it once; a boundary week names both.
    expect(selectedWeekLabel(report, 2, dict)).toBe("10–16 Aug · W3");
    expect(selectedWeekLabel(report, 0, dict)).toBe("27 Jul – 2 Aug · W1");
    expect(selectedWeekPartialNotice(report, 2, dict)).toBeNull();
    expect(selectedWeekPartialNotice(report, 0, dict)).toBe(
      `2 ${dict.reports.partialDays}`,
    );
    expect(selectedWeekPartialNotice(report, 5, dict)).toBe(
      `1 ${dict.reports.partialDay}`,
    );
  });

  it("counts how much of the month carried data", () => {
    expect(weeksWithDataLabel(report, dict)).toBe(
      `3 ${dict.reports.ofWeeks} 6 ${dict.reports.weeksWithData}`,
    );
  });
});

/* ------------------------------------------------------ week vs the month -- */

describe("week against the monthly average", () => {
  it("compares a week with the average week, not the whole month", () => {
    const rows = buildComparisonRows(report, 2, dict);
    const cost = rows.find((row) => row.key === "cost");

    // Week 3 is £80; the average working week is £480/3 = £160.
    expect(cost?.weekValue).toBe("£80.00");
    expect(cost?.monthValue).toBe("£160.00");
    expect(cost?.delta).toEqual({ absolute: -80, percent: -50 });
  });

  it("emits the four rows the panel renders", () => {
    expect(buildComparisonRows(report, 2, dict).map((row) => row.key)).toEqual([
      "cost",
      "hours",
      "rate",
      "staff",
    ]);
  });

  it("survives a week with nothing in it", () => {
    const rows = buildComparisonRows(report, 0, dict);

    expect(rows.find((row) => row.key === "cost")?.weekValue).toBe("£0.00");
    expect(rows.find((row) => row.key === "rate")?.weekValue).toBe(dict.common.dash);
    // No rate on either side of a comparison means no comparison.
    expect(rows.find((row) => row.key === "rate")?.delta).toBeNull();
  });

  it("invents no percentage for a figure the empty month never had", () => {
    const rows = buildComparisonRows(empty, 1, dict);
    const by = (key: string) => rows.find((row) => row.key === key);

    // Every remaining figure averaged zero over an empty month, so none of them
    // has a baseline to be a percentage of.
    for (const key of ["cost", "hours", "staff"]) {
      expect(by(key)?.delta?.percent ?? null, key).toBeNull();
    }

    for (const row of rows) {
      expect(Number.isFinite(row.delta?.absolute ?? 0), row.key).toBe(true);
      expect(Number.isFinite(row.delta?.percent ?? 0), row.key).toBe(true);
    }
  });

  it("returns nothing for a week index that does not exist", () => {
    expect(buildComparisonRows(report, 99, dict)).toEqual([]);
    expect(selectedWeekLabel(report, 99, dict)).toBe(dict.common.dash);
  });
});

/* ---------------------------------------------------------------- employees -- */

describe("employee distribution", () => {
  it("keeps the report's cost order and formats each row", () => {
    const slices = buildDonutSlices(report, dict, "en");

    // ME: 32h × £10 = £320 (66.7%). YOU: 8h × £20 = £160 (33.3%).
    expect(slices.map((slice) => slice.employeeId)).toEqual([ME, YOU]);
    expect(slices[0].costLabel).toBe("£320.00");
    expect(slices[0].shareLabel).toBe("66.7%");
    expect(slices[1].shareLabel).toBe("33.3%");
  });

  it("localises the position without the domain having to know a locale", () => {
    expect(buildDonutSlices(report, dict, "en")[1].position).toBe("Cashier");
    expect(buildDonutSlices(report, tr, "tr")[1].position).toBe("Kasiyer");
  });

  it("has shares that add up to a whole", () => {
    const total = buildDonutSlices(report, dict, "en")
      .map((slice) => Number(slice.shareLabel.replace("%", "")))
      .reduce((sum, value) => sum + value, 0);

    expect(total).toBeCloseTo(100, 1);
  });

  it("has nothing to draw for an empty month", () => {
    expect(buildDonutSlices(empty, dict, "en")).toEqual([]);
  });
});

/* ------------------------------------------------------------------- i18n -- */

describe("both locales carry every report string", () => {
  it("has the same keys in Turkish and English", () => {
    expect(Object.keys(tr.reports).sort()).toEqual(Object.keys(dict.reports).sort());
  });

  it("leaves nothing blank", () => {
    for (const locale of ["tr", "en"] as const) {
      const { reports, nav, menu } = getDictionary(locale);
      for (const [key, value] of Object.entries(reports)) {
        expect(value, `${locale}.reports.${key}`).toBeTruthy();
      }
      expect(nav.reports).toBeTruthy();
      expect(menu.reports).toBeTruthy();
    }
  });
});
