"use server";

import { compare, hash } from "bcryptjs";
import { refresh } from "next/cache";

import { isValidIsoDate } from "@/lib/date";
import { assertAuthenticated } from "@/server/auth/session";
import { employeeRepository } from "@/server/repositories/employee.repository";
import { userRepository } from "@/server/repositories/user.repository";

import { ACTION_OK, actionError, toActionResult, type ActionResult } from "./action-result";

/** Kept in step with `employee.actions.ts` — the same rule for every password. */
const MIN_PASSWORD_LENGTH = 8;

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/**
 * Self-service edit of the signed-in person's own record.
 *
 * Deliberately narrower than `updateEmployeeAction`: position, contract, hourly
 * rate, leave balance and role are payroll decisions, so they stay with the
 * manager. Everything this action touches is contact detail the person owns.
 * The employee id always comes from the session, never from the form.
 */
export async function updateProfileAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await assertAuthenticated();

    const firstName = text(formData, "firstName");
    if (!firstName) return actionError("nameRequired");

    // The email is the sign-in identifier, so clearing it would lock the person
    // out of the panel they are standing in.
    const email = text(formData, "email").toLowerCase();
    if (!email) return actionError("emailRequired");

    const account = await userRepository.findByEmployeeId(session.employeeId);
    const emailChanged = account !== null && account.email !== email;

    if (emailChanged) {
      const owner = await userRepository.findByEmail(email);
      if (owner && owner.employeeId !== session.employeeId) return actionError("emailTaken");
    }

    const newPassword = text(formData, "newPassword");
    let passwordHash: string | null = null;

    if (newPassword) {
      if (newPassword.length < MIN_PASSWORD_LENGTH) return actionError("passwordTooShort");
      if (!account) return actionError("accountNeedsEmail");

      // Knowing the session cookie is not the same as knowing the password —
      // a self-service change has to prove the old one first.
      const currentPassword = text(formData, "currentPassword");
      if (!currentPassword) return actionError("currentPasswordRequired");
      if (!(await compare(currentPassword, account.passwordHash))) {
        return actionError("wrongPassword");
      }

      passwordHash = await hash(newPassword, 10);
    }

    const birthDate = text(formData, "birthDate");

    const updated = await employeeRepository.update(session.employeeId, {
      firstName,
      lastName: text(formData, "lastName"),
      birthDate: isValidIsoDate(birthDate) ? birthDate : null,
      phone: text(formData, "phone"),
      email,
      address: text(formData, "address"),
    });
    if (!updated) return actionError("notFound");

    if (passwordHash) {
      await userRepository.upsertCredentials(session.employeeId, email, passwordHash);
    } else if (emailChanged) {
      await userRepository.updateEmail(session.employeeId, email);
    }

    refresh();
    return ACTION_OK;
  } catch (error) {
    return toActionResult(error);
  }
}
