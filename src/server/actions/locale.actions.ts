"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";

import { LOCALE_COOKIE } from "@/lib/constants";
import { getLocale } from "@/lib/i18n/server";
import { isLocale, otherLocale } from "@/lib/i18n";

import type { Locale } from "@/types/domain";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Writes the language cookie.
 *
 * No authorisation check, unlike every other action in this directory, and that
 * is deliberate rather than an omission: the locale is a rendering preference
 * held in a cookie, it exposes and mutates no data, and the login page has to be
 * able to change it before anyone is signed in.
 */
async function writeLocale(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
  });

  refresh();
}

/** Flips the UI between Turkish and English. Used by the login screen. */
export async function toggleLocaleAction(): Promise<void> {
  await writeLocale(otherLocale(await getLocale()));
}

/**
 * Selects a language outright, rather than flipping to whatever is not current.
 *
 * The locale arrives as the submitting button's own `name`/`value` pair, so the
 * two-flag picker is one form with two submit buttons — no `bind`, no hidden
 * field, and no client JavaScript. An unrecognised value is ignored rather than
 * defaulted: a malformed POST should leave the cookie alone, not silently move
 * the user to Turkish.
 */
export async function setLocaleAction(formData: FormData): Promise<void> {
  const requested = formData.get("locale");
  if (!isLocale(requested)) return;

  await writeLocale(requested);
}
