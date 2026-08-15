import type { RosterCellView } from "./view-model";

/** Shared cell colouring so the grid and person views can never diverge. */
export function cellClass(cell: RosterCellView, isTaskRow: boolean): string {
  if (cell.state === "shift") {
    return isTaskRow ? "bg-fill-strong text-ink" : "bg-brand text-white";
  }
  if (cell.state === "leave") return "bg-warn-soft text-warn-dark";
  return "bg-fill text-disabled";
}
