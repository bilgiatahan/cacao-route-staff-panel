/**
 * Chart geometry, as pure arithmetic.
 *
 * The two charts on the monthly report are hand-drawn SVG rather than a charting
 * library: both shapes are simple, and a library would turn every glyph into a
 * client component and drag a runtime into the bundle for two static pictures.
 * The same reasoning that puts `lucide` behind `Icon` instead of `lucide-react`.
 *
 * Keeping the maths here rather than inside the components means the awkward
 * cases — an all-zero month, a single slice, a value so small its arc rounds to
 * nothing — are testable without a DOM.
 */

/** Bar heights are percentages of the tallest bar, so the SVG scales freely. */
export interface BarGeometry {
  /** 0–100. A zero value still gets a hairline so the bar reads as "none", not "missing". */
  heightPercent: number;
  /** Whether this bar is the one the reader asked about. */
  isSelected: boolean;
}

/** The floor a zero bar is drawn at, in percent — visible, but obviously empty. */
export const EMPTY_BAR_PERCENT = 1.5;

/**
 * Scales values against the largest of them.
 *
 * The domain always starts at zero: a bar chart of money whose baseline floats
 * exaggerates small differences into dramatic ones, which is the single easiest
 * way to make a truthful dataset lie.
 */
export function barGeometry(values: number[], selectedIndex = -1): BarGeometry[] {
  const peak = Math.max(0, ...values);

  return values.map((value, index) => ({
    heightPercent:
      peak === 0 || value <= 0 ? EMPTY_BAR_PERCENT : Math.max(EMPTY_BAR_PERCENT, (value / peak) * 100),
    isSelected: index === selectedIndex,
  }));
}

/** Where a reference line (the monthly average) sits within the same domain. */
export function referencePercent(value: number, values: number[]): number | null {
  const peak = Math.max(0, ...values);
  if (peak === 0 || value <= 0) return null;
  return Math.min(100, (value / peak) * 100);
}

export interface DonutSlice {
  /** `d` attribute for the slice's arc. */
  path: string;
  /** 0–100, already rounded for display. */
  percent: number;
}

/** Geometry of the ring: a square viewBox with the hole in the middle. */
export const DONUT = {
  size: 120,
  center: 60,
  radius: 46,
  thickness: 20,
} as const;

/**
 * Arc paths for a donut, clockwise from twelve o'clock.
 *
 * Drawn as stroked arcs rather than filled wedges, so the ring thickness is one
 * number and no inner edge has to be computed. Values that sum to zero produce
 * no slices at all — the caller draws the empty ring instead of a full circle of
 * nothing, which would read as "one category holds everything".
 */
export function donutSlices(values: number[]): DonutSlice[] {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0) return [];

  const slices: DonutSlice[] = [];
  let startAngle = 0;

  for (const value of values) {
    const share = Math.max(0, value) / total;
    if (share === 0) {
      slices.push({ path: "", percent: 0 });
      continue;
    }

    // A slice of a whole turn cannot be drawn as one arc — the start and end
    // points coincide and the renderer draws nothing at all.
    const sweep = Math.min(share * 360, 359.99);
    const endAngle = startAngle + sweep;

    slices.push({
      path: arcPath(startAngle, endAngle),
      percent: share * 100,
    });

    startAngle = endAngle;
  }

  return slices;
}

/** Polar to Cartesian, with 0° at twelve o'clock and angles running clockwise. */
function pointOnRing(angleDegrees: number): { x: number; y: number } {
  const radians = ((angleDegrees - 90) * Math.PI) / 180;
  return {
    x: DONUT.center + DONUT.radius * Math.cos(radians),
    y: DONUT.center + DONUT.radius * Math.sin(radians),
  };
}

function arcPath(startAngle: number, endAngle: number): string {
  const start = pointOnRing(startAngle);
  const end = pointOnRing(endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${round(start.x)} ${round(start.y)}`,
    `A ${DONUT.radius} ${DONUT.radius} 0 ${largeArc} 1 ${round(end.x)} ${round(end.y)}`,
  ].join(" ");
}

/** Two decimals is plenty for a 120-unit viewBox, and keeps the markup small. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
