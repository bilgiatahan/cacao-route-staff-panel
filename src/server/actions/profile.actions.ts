"use server";

import { compare, hash } from "bcryptjs";
import { refresh } from "next/cache";

import { checkPersonFields, readIsoDate } from "@/lib/forms/person-fields";
import { PASSWORD_RULE, passwordByteLength } from "@/lib/forms/rules";
import { assertAuthenticated } from "@/server/auth/session";
import { employeeRepository } from "@/server/repositories/employee.repository";
import { userRepository } from "@/server/repositories/user.repository";

import { ACTION_OK, actionError, toActionResult, type ActionResult } from "./action-result";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/**
 * Self-service edit of the signed-in person's own contact details.
 *
 * Deliberately narrower than `updateEmployeeAction`: position, contract, hourly
 * rate, leave balance and role are payroll decisions, so they stay with the
 * manager. Everything this action touches is contact detail the person owns.
 * The employee id always comes from the session, never from the form.
 *
 * The password used to be handled here too. It is now `changePasswordAction`,
 * because the two are different decisions with different failure modes: one is
 * "my number changed", the other has to prove you know the old secret. Sharing a
 * submit meant a mistyped password rolled back a phone number, and a blank
 * `firstName` in a password-only submit would have failed the wrong validation.
 */
export async function updateProfileAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await assertAuthenticated();

    const fields = {
      firstName: text(formData, "firstName"),
      lastName: text(formData, "lastName"),
      // The address is the sign-in identifier here, so clearing it would lock
      // the person out of the panel they are standing in.
      email: text(formData, "email").toLowerCase(),
      phone: text(formData, "phone"),
      address: text(formData, "address"),
      birthDate: readIsoDate(text(formData, "birthDate")),
    };

    const invalid = checkPersonFields(fields, { emailRequired: true });
    if (invalid) return invalid;

    const account = await userRepository.findByEmployeeId(session.employeeId);
    const emailChanged = account !== null && account.email !== fields.email;

    if (emailChanged) {
      const owner = await userRepository.findByEmail(fields.email);
      if (owner && owner.employeeId !== session.employeeId) return actionError("emailTaken");
    }

    const updated = await employeeRepository.update(session.employeeId, fields);
    if (!updated) return actionError("notFound");

    if (emailChanged) {
      await userRepository.updateEmail(session.employeeId, fields.email);
    }

    refresh();
    return ACTION_OK;
  } catch (error) {
    return toActionResult(error);
  }
}

/**
 * The signed-in person changing their own password.
 *
 * Its own action rather than a branch of the profile save, so each one validates
 * only what it owns: this never looks at a name, and the profile save never sees
 * a password. That also means a password-only POST cannot arrive with an empty
 * `firstName` and fail as `nameRequired`.
 *
 * Knowing the session cookie is not the same as knowing the password, so the old
 * one has to be proven first — a borrowed laptop should not be enough to lock the
 * owner out of their own account.
 */
export async function changePasswordAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await assertAuthenticated();

    const currentPassword = text(formData, "currentPassword");
    if (!currentPassword) return actionError("currentPasswordRequired");

    const newPassword = text(formData, "newPassword");
    if (newPassword.length < PASSWORD_RULE.minLength) return actionError("passwordTooShort");
    // Bytes, not characters: bcrypt stops at 72 bytes and silently ignores the
    // rest, so a longer password would only appear to have been accepted.
    if (passwordByteLength(newPassword) > PASSWORD_RULE.maxLength) {
      return actionError("passwordTooLong");
    }

    // Checked before the hash comparison, so a typo in the confirmation costs
    // nothing and the answer does not depend on the old password being right.
    if (text(formData, "confirmPassword") !== newPassword) {
      return actionError("passwordMismatch");
    }
    if (newPassword === currentPassword) return actionError("passwordUnchanged");

    const account = await userRepository.findByEmployeeId(session.employeeId);
    // No sign-in at all — a roster entry the manager never gave an account to.
    if (!account) return actionError("noAccount");

    if (!(await compare(currentPassword, account.passwordHash))) {
      return actionError("wrongPassword");
    }

    await userRepository.upsertCredentials(
      session.employeeId,
      account.email,
      await hash(newPassword, 10),
    );

    refresh();
    return ACTION_OK;
  } catch (error) {
    return toActionResult(error);
  }
}
