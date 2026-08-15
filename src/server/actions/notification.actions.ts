"use server";

import { refresh } from "next/cache";

import { assertAuthenticated } from "@/server/auth/session";
import { notificationRepository } from "@/server/repositories/notification.repository";

import { ACTION_OK, toActionResult, type ActionResult } from "./action-result";

export async function markNotificationReadAction(
  notificationId: string,
): Promise<ActionResult> {
  try {
    const viewer = await assertAuthenticated();
    await notificationRepository.markRead(notificationId, viewer.employeeId);

    refresh();
    return ACTION_OK;
  } catch (error) {
    return toActionResult(error);
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  try {
    const viewer = await assertAuthenticated();
    await notificationRepository.markAllRead(viewer);

    refresh();
    return ACTION_OK;
  } catch (error) {
    return toActionResult(error);
  }
}
