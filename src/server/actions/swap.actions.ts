"use server";

import { refresh } from "next/cache";

import { isValidIsoDate } from "@/lib/date";
import { assertAdmin, assertAuthenticated } from "@/server/auth/session";
import { employeeRepository } from "@/server/repositories/employee.repository";
import { shiftRepository } from "@/server/repositories/shift.repository";
import { swapRepository } from "@/server/repositories/swap.repository";
import { notificationService } from "@/server/services/notification.service";

import { ACTION_OK, actionError, toActionResult, type ActionResult } from "./action-result";

export async function createSwapRequestAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const viewer = await assertAuthenticated();

    const date = String(formData.get("date") ?? "");
    const targetId = String(formData.get("targetId") ?? "");
    if (!isValidIsoDate(date) || !targetId) return actionError("notFound");
    if (targetId === viewer.employeeId) return actionError("notFound");

    // Only a shift you actually hold can be offered.
    const shift = await shiftRepository.findByEmployeeAndDate(viewer.employeeId, date);
    if (!shift) return actionError("notFound");

    const target = await employeeRepository.findById(targetId);
    const requester = await employeeRepository.findById(viewer.employeeId);
    if (!target || !requester) return actionError("notFound");

    const request = await swapRepository.create({
      requesterId: viewer.employeeId,
      targetId,
      date,
    });

    await notificationService.swapRequested(requester, target, request);

    refresh();
    return ACTION_OK;
  } catch (error) {
    return toActionResult(error);
  }
}

/** Approving a swap actually moves the shift onto the other person's row. */
export async function decideSwapAction(
  requestId: string,
  decision: "approved" | "rejected",
): Promise<ActionResult> {
  try {
    await assertAdmin();

    const request = await swapRepository.decide(requestId, decision);
    if (!request) return actionError("notFound");

    if (decision === "approved") {
      await shiftRepository.reassign(request.requesterId, request.targetId, request.date);
    }

    await notificationService.swapDecided(request);

    refresh();
    return ACTION_OK;
  } catch (error) {
    return toActionResult(error);
  }
}
