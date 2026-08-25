"use server";

import { hash } from "bcryptjs";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { checkPersonFields, readIsoDate } from "@/lib/forms/person-fields";
import { PASSWORD_RULE, passwordByteLength } from "@/lib/forms/rules";
import { ROUTES } from "@/lib/routes";
import { assertAdmin } from "@/server/auth/session";
import { employeeRepository, type EmployeeDraft } from "@/server/repositories/employee.repository";
import { userRepository } from "@/server/repositories/user.repository";
import type { ContractType } from "@/types/domain";

import { ACTION_OK, actionError, toActionResult, type ActionResult } from "./action-result";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function positiveNumber(formData: FormData, key: string, fallback = 0): number {
  const value = Number(formData.get(key));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function contractType(formData: FormData): ContractType {
  return formData.get("contract") === "full" ? "full" : "part";
}

/** Either the draft, or the first rule the submission broke. */
type DraftResult = { draft: EmployeeDraft } | { error: ActionResult };

/**
 * Shared shape for the create and update forms, validated.
 *
 * The validation goes through `checkPersonFields`, the same function
 * `updateProfileAction` uses. Before that, this form checked only that a first
 * name was present — so a manager could save a phone number, an email address or
 * a birth date that the person's own profile form would then refuse, leaving them
 * unable to edit their own record until someone fixed it here.
 *
 * `email` is optional on this form and required on the profile one, which is the
 * one real difference: a roster row can legitimately have no account — a task row
 * like "Cleaning", or someone whose login is set up later.
 */
function readDraft(formData: FormData): DraftResult {
  const position = text(formData, "position");

  const fields = {
    firstName: text(formData, "firstName"),
    lastName: text(formData, "lastName"),
    position,
    email: text(formData, "email").toLowerCase(),
    phone: text(formData, "phone"),
    address: text(formData, "address"),
    birthDate: readIsoDate(text(formData, "birthDate")),
  };

  const invalid = checkPersonFields(fields, { emailRequired: false });
  if (invalid) return { error: invalid };

  return {
    draft: {
      ...fields,
      // A single position field feeds both locales; translating job titles per
      // language is an editorial job, not something to guess at here.
      position: { tr: position, en: position },
      // No fallback rate: the old one was 130, a lira figure left behind by the
      // move to London, and a plausible-looking wrong number is worse than a
      // visible zero.
      hourlyRate: positiveNumber(formData, "hourlyRate"),
      contract: contractType(formData),
      hiredAt: readIsoDate(text(formData, "hiredAt")),
      leaveBalance: positiveNumber(formData, "leaveBalance"),
      role: "staff",
      isTaskRow: false,
    },
  };
}

/**
 * Validates the optional sign-in password. Returns `null` when the field was left
 * blank, which means "no account" on create and "leave the password alone" on
 * update.
 */
function readPassword(
  formData: FormData,
  draft: EmployeeDraft,
): { password: string } | { error: ActionResult } | null {
  const password = text(formData, "password");
  if (!password) return null;

  if (password.length < PASSWORD_RULE.minLength) {
    return { error: actionError("passwordTooShort") };
  }
  // Bytes, not characters: bcrypt stops at 72 bytes and silently ignores the
  // rest, so a longer password would only appear to have been accepted.
  if (passwordByteLength(password) > PASSWORD_RULE.maxLength) {
    return { error: actionError("passwordTooLong") };
  }
  if (!draft.email) {
    // The email is the login identifier, so an account cannot exist without one.
    return { error: actionError("accountNeedsEmail") };
  }
  return { password };
}

export async function createEmployeeAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  let createdId: string | null = null;

  try {
    await assertAdmin();

    const parsed = readDraft(formData);
    if ("error" in parsed) return parsed.error;
    const { draft } = parsed;

    const credentials = readPassword(formData, draft);
    if (credentials && "error" in credentials) return credentials.error;

    if (credentials && (await userRepository.findByEmail(draft.email))) {
      return actionError("emailTaken");
    }

    const passwordHash = credentials ? await hash(credentials.password, 10) : undefined;
    const employee = await employeeRepository.create(draft, passwordHash);
    createdId = employee.id;
  } catch (error) {
    return toActionResult(error);
  }

  // `redirect` throws by design — it must sit outside the try/catch.
  redirect(ROUTES.teamMember(createdId));
}

export async function updateEmployeeAction(
  employeeId: string,
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await assertAdmin();

    const parsed = readDraft(formData);
    if ("error" in parsed) return parsed.error;
    const { draft } = parsed;

    const existing = await employeeRepository.findById(employeeId);
    if (!existing) return actionError("notFound");

    const credentials = readPassword(formData, draft);
    if (credentials && "error" in credentials) return credentials.error;

    if (credentials) {
      // The email doubles as the login, so it must not collide with someone else's.
      const owner = await userRepository.findByEmail(draft.email);
      if (owner && owner.employeeId !== employeeId) return actionError("emailTaken");
    }

    // Role and task-row status are not editable from this form.
    const updated = await employeeRepository.update(employeeId, {
      ...draft,
      role: existing.role,
      isTaskRow: existing.isTaskRow,
    });
    if (!updated) return actionError("notFound");

    if (credentials) {
      await userRepository.upsertCredentials(
        employeeId,
        draft.email,
        await hash(credentials.password, 10),
      );
    }

    refresh();
    return ACTION_OK;
  } catch (error) {
    return toActionResult(error);
  }
}

export async function archiveEmployeeAction(employeeId: string): Promise<ActionResult> {
  let archived = false;

  try {
    const admin = await assertAdmin();
    // Removing yourself would lock the panel's only manager out of it.
    if (admin.employeeId === employeeId) return actionError("forbidden");

    archived = await employeeRepository.archive(employeeId);
    if (!archived) return actionError("notFound");
  } catch (error) {
    return toActionResult(error);
  }

  redirect(ROUTES.team);
}
