"use server";

import { hash } from "bcryptjs";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { isValidIsoDate } from "@/lib/date";
import { ROUTES } from "@/lib/routes";
import { assertAdmin } from "@/server/auth/session";
import { employeeRepository, type EmployeeDraft } from "@/server/repositories/employee.repository";
import { userRepository } from "@/server/repositories/user.repository";
import type { ContractType } from "@/types/domain";

import { ACTION_OK, actionError, toActionResult, type ActionResult } from "./action-result";

/** Short enough to stay usable for a café team, long enough not to be trivial. */
const MIN_PASSWORD_LENGTH = 8;

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalIsoDate(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return isValidIsoDate(value) ? value : null;
}

function positiveNumber(formData: FormData, key: string, fallback = 0): number {
  const value = Number(formData.get(key));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function contractType(formData: FormData): ContractType {
  return formData.get("contract") === "full" ? "full" : "part";
}

/** Shared shape for the create and update forms. */
function readDraft(formData: FormData): EmployeeDraft | null {
  const firstName = text(formData, "firstName");
  if (!firstName) return null;

  const position = text(formData, "position");

  return {
    firstName,
    lastName: text(formData, "lastName"),
    // A single position field feeds both locales; translating job titles per
    // language is an editorial job, not something to guess at here.
    position: { tr: position, en: position },
    hourlyRate: positiveNumber(formData, "hourlyRate", 130),
    contract: contractType(formData),
    birthDate: optionalIsoDate(formData, "birthDate"),
    hiredAt: optionalIsoDate(formData, "hiredAt"),
    leaveBalance: positiveNumber(formData, "leaveBalance"),
    phone: text(formData, "phone"),
    email: text(formData, "email").toLowerCase(),
    address: text(formData, "address"),
    role: "staff",
    isTaskRow: false,
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

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: actionError("passwordTooShort") };
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

    const draft = readDraft(formData);
    if (!draft) return actionError("nameRequired");

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

    const draft = readDraft(formData);
    if (!draft) return actionError("nameRequired");

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
