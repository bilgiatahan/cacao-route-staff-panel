"use server";

import { refresh } from "next/cache";

import { addIsoDays, DAYS_IN_WEEK, isValidIsoDate, startOfWeekIso } from "@/lib/date";
import { isRosterMember } from "@/lib/employee";
import { timeToMinutes } from "@/lib/format";
import { assertAdmin } from "@/server/auth/session";
import { employeeRepository } from "@/server/repositories/employee.repository";
import { shiftRepository } from "@/server/repositories/shift.repository";

import { ACTION_OK, actionError, toActionResult, type ActionResult } from "./action-result";

export interface SaveShiftInput {
  employeeId: string;
  date: string;
  /** `HH:mm` */
  startTime: string;
  endTime: string;
}

/** Creates or replaces one employee's shift on one day. Admin only. */
export async function saveShiftAction(input: SaveShiftInput): Promise<ActionResult> {
  try {
    await assertAdmin();

    if (!input.employeeId || !isValidIsoDate(input.date)) return actionError("notFound");

    const startMinutes = timeToMinutes(input.startTime);
    const endMinutes = timeToMinutes(input.endTime);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      return actionError("invalidTime");
    }

    await shiftRepository.upsert({
      employeeId: input.employeeId,
      date: input.date,
      startMinutes,
      endMinutes,
    });

    refresh();
    return ACTION_OK;
  } catch (error) {
    return toActionResult(error);
  }
}

export async function clearShiftAction(
  employeeId: string,
  date: string,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    if (!employeeId || !isValidIsoDate(date)) return actionError("notFound");

    await shiftRepository.remove(employeeId, date);

    refresh();
    return ACTION_OK;
  } catch (error) {
    return toActionResult(error);
  }
}

/**
 * Fills a week with a copy of the week before it. Admin only.
 *
 * The roster repeats far more often than it changes, so the common case is an
 * admin retyping last week's grid cell by cell. This writes the whole week in
 * one go and leaves every cell editable afterwards — it is a starting point, not
 * a lock.
 *
 * Two things it deliberately does not do:
 *
 *  - **Merge.** The target week is replaced, not added to, so the result is
 *    exactly last week rather than an overlay whose outcome depends on what was
 *    already there. The UI says so before it runs, and says how many shifts are
 *    about to go.
 *  - **Notify.** Editing a single cell does not announce itself either, and a
 *    week filled in before anyone reads it is not news. The staff see the week
 *    when they open it.
 *
 * Leave is not consulted: approved leave shadows a cell in every roster view
 * (`lib/domain/schedule.ts`), so a copied shift on a leave day shows up as one
 * to fix rather than hiding. Dropping those rows silently would leave a hole the
 * admin never asked for and would not notice.
 */
export async function copyPreviousWeekAction(weekStart: string): Promise<ActionResult> {
  try {
    await assertAdmin();

    if (!isValidIsoDate(weekStart)) return actionError("notFound");

    // Normalised the way the page normalises `?week=`, so a mid-week date can
    // never copy into a window straddling two weeks.
    const target = startOfWeekIso(weekStart);
    const source = addIsoDays(target, -DAYS_IN_WEEK);

    const employees = await employeeRepository.list();
    const roster = employees.filter(isRosterMember).map((employee) => employee.id);

    const { copied } = await shiftRepository.copyWeek(source, target, roster);
    // Nothing was written, so nothing was destroyed either — say so rather than
    // report a success that changed no cell on screen.
    if (copied === 0) return actionError("nothingToCopy");

    refresh();
    return ACTION_OK;
  } catch (error) {
    return toActionResult(error);
  }
}
