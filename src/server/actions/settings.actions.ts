"use server";

import { refresh } from "next/cache";

import { assertAdmin } from "@/server/auth/session";
import { settingsRepository } from "@/server/repositories/settings.repository";

import { ACTION_OK, toActionResult, type ActionResult } from "./action-result";

/**
 * Saves the panel settings. Admin only — like every action in this directory it
 * checks for itself, because a Server Function is reachable by a plain POST and
 * the proxy's cookie check says nothing about a role.
 */
export async function updateSettingsAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await assertAdmin();

    // An unchecked checkbox posts nothing at all, so the absence of the field is
    // "off" rather than "unchanged" — the form always submits the complete
    // state of the switch, never a delta.
    await settingsRepository.update({
      staffCanSeePay: formData.get("staffCanSeePay") !== null,
    });

    refresh();
    return ACTION_OK;
  } catch (error) {
    return toActionResult(error);
  }
}
