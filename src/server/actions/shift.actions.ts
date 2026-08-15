"use server";

import { refresh } from "next/cache";

import { isValidIsoDate } from "@/lib/date";
import { timeToMinutes } from "@/lib/format";
import { assertAdmin } from "@/server/auth/session";
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
