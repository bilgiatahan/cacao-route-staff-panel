import type { RosterCellView } from "./view-model";

/**
 * Shared cell colouring so the grid and person views can never diverge.
 *
 * An off day used to be a `text-disabled` middot at 1.66:1 — the state was
 * carried by a glyph nobody could read. It is `text-muted` now (5.18:1 on
 * `bg-fill`) and still reads as subordinate, because the hierarchy here comes
 * from the *fill*: a scheduled cell is solid brand with white text, which no
 * amount of legible grey competes with. Contrast and subordination were never
 * actually in tension.
 */
export function cellClass(cell: RosterCellView, isTaskRow: boolean): string {
  if (cell.state === "shift") {
    return isTaskRow ? "bg-fill-strong text-ink" : "bg-brand text-white";
  }
  if (cell.state === "leave") return "bg-warn-soft text-warn-dark";
  return "bg-fill text-muted";
}
