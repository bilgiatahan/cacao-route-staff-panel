"use server";

import { AuthError } from "next-auth";

import { ROUTES } from "@/lib/routes";
import { signIn, signOut } from "@/server/auth";

import { actionError, type ActionResult } from "./action-result";

export async function signInAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const callbackUrl = String(formData.get("callbackUrl") ?? "") || ROUTES.summary;

  try {
    // On success this throws a redirect, so nothing below runs.
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: callbackUrl,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return actionError(
        error.type === "CredentialsSignin" ? "invalidCredentials" : "unexpected",
      );
    }
    throw error;
  }
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: ROUTES.login });
}
