import { cn } from "@/lib/utils";

export interface LegendItem {
  key: string;
  swatchClass: string;
  label: string;
}

/**
 * Colour key for the roster grid.
 *
 * Every cell also states its own condition — the times for a shift, a localised
 * marker for leave, a dash for a day off, and the row's hours column reads
 * "Task" for a task row — plus `stateLabel` in each cell's accessible name. So
 * this is a convenience for scanning a dense grid, never the only way a state
 * can be read.
 */
export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-2", className)}>
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn("size-3 rounded-sm border border-line", item.swatchClass)}
          />
          <span className="text-xs text-muted">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
