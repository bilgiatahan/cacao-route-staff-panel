"use server";

import { refresh } from "next/cache";

import { isValidIsoDate, todayIso } from "@/lib/date";
import { assertAdmin, assertAuthenticated } from "@/server/auth/session";
import { employeeRepository } from "@/server/repositories/employee.repository";
import { leaveRepository } from "@/server/repositories/leave.repository";
import { notificationService } from "@/server/services/notification.service";
import type { LeaveType } from "@/types/domain";

import { ACTION_OK, actionError, toActionResult, type ActionResult } from "./action-result";

const LEAVE_TYPES: LeaveType[] = ["annual", "sick", "excuse"];

function parseLeaveType(value: FormDataEntryValue | null): LeaveType {
  const candidate = String(value ?? "");
  return LEAVE_TYPES.includes(candidate as LeaveType) ? (candidate as LeaveType) : "annual";
}

/** Staff submit leave for themselves; the employee id never comes from the form. */
export async function createLeaveRequestAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const viewer = await assertAuthenticated();

    const startDate = String(formData.get("startDate") ?? "");
    const endDate = String(formData.get("endDate") ?? "");
    if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
      return actionError("invalidRange");
    }
    if (endDate < startDate) return actionError("invalidRange");

    // Leave is asked for, not recorded after the fact: the form's picker starts
    // at today, and this is the same rule where it can be enforced. Checked
    // after the range so a backwards range still reports the range.
    if (startDate < todayIso()) return actionError("startDateInPast");

    const request = await leaveRepository.create({
      employeeId: viewer.employeeId,
      type: parseLeaveType(formData.get("type")),
      startDate,
      endDate,
      note: String(formData.get("note") ?? "").trim().slice(0, 280),
    });

    const employee = await employeeRepository.findById(viewer.employeeId);
    if (employee) await notificationService.leaveRequested(employee, request);

    refresh();
    return ACTION_OK;
  } catch (error) {
    return toActionResult(error);
  }
}

export async function decideLeaveAction(
  requestId: string,
  decision: "approved" | "rejected",
): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();

    const request = await leaveRepository.decide(requestId, decision, admin.employeeId);
    if (!request) return actionError("notFound");

    const employee = await employeeRepository.findById(request.employeeId);
    if (employee) await notificationService.leaveDecided(employee, request);

    refresh();
    return ACTION_OK;
  } catch (error) {
    return toActionResult(error);
  }
}
