import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { formatSignedPercent } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import type { Delta } from "@/lib/domain/monthly-cost";

/**
 * How a figure moved, as a chip.
 *
 * Two deliberate decisions:
 *
 * 1. **Direction is drawn, not only coloured.** The arrow carries the sign, so
 *    the chip survives being read in greyscale or by someone who cannot separate
 *    the two hues. Colour is the second signal, never the only one.
 *
 * 2. **Rising is not automatically good.** `sentiment` is set by the caller
 *    because it depends on the metric: more cost is not an achievement, more
 *    hours is neither good nor bad, and more uncovered days is plainly worse. A
 *    chip that painted every increase green would congratulate a manager on a
 *    wage bill going up.
 */
export type TrendSentiment = "lowerIsBetter" | "neutral";

export interface TrendChipProps {
  delta: Delta | null;
  dict: Dictionary;
  /** Defaults to `neutral` — a volume that moved, with no verdict attached. */
  sentiment?: TrendSentiment;
}

function toneFor(percent: number | null, sentiment: TrendSentiment): BadgeTone {
  if (percent === null || percent === 0) return "neutral";
  if (sentiment === "neutral") return "info";
  return percent > 0 ? "warning" : "success";
}

export function TrendChip({ delta, dict, sentiment = "neutral" }: TrendChipProps) {
  // No baseline at all — say so rather than implying a flat month.
  if (!delta) {
    return <span className="flex-none text-xs text-muted">{dict.common.dash}</span>;
  }

  const { percent } = delta;
  const rising = percent !== null && percent > 0;
  const falling = percent !== null && percent < 0;

  return (
    <Badge tone={toneFor(percent, sentiment)} className="flex-none gap-1">
      {rising || falling ? (
        <Icon name={rising ? "trendUp" : "trendDown"} className="h-3 w-3" />
      ) : null}
      <span className="tabular">{formatSignedPercent(percent, dict)}</span>
    </Badge>
  );
}
