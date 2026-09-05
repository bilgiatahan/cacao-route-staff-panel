"use server";

import { refresh } from "next/cache";

import { isValidIsoDate, todayIso } from "@/lib/date";
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

    // Only a shift still ahead of you can be handed over. The select offers
    // nothing else, but a Server Function can be posted to directly — and a page
    // left open overnight would otherwise submit yesterday's option.
    if (date <= todayIso()) return actionError("shiftPassed");

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

/**
 * Approving a swap actually moves the shift onto the other person's row, so the
 * approval goes through `swapRepository.approve`, which does both in one
 * transaction. A rejection changes nothing but the status, so it stays on the
 * plain `decide` path.
 *
 * Either way a `null` means nothing was written — the request was already
 * decided, or the shift is no longer there to move — so the notification and
 * the success result sit behind that check and can only follow a real change.
 */
export async function decideSwapAction(
  requestId: string,
  decision: "approved" | "rejected",
): Promise<ActionResult> {
  try {
    await assertAdmin();

    const request =
      decision === "approved"
        ? await swapRepository.approve(requestId)
        : await swapRepository.decide(requestId, decision);

    if (!request) return actionError("notFound");

    await notificationService.swapDecided(request);

    refresh();
    return ACTION_OK;
  } catch (error) {
    return toActionResult(error);
  }
}
