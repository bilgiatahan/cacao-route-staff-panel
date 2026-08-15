"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";

import { LOCALE_COOKIE } from "@/lib/constants";
import { getLocale } from "@/lib/i18n/server";
import { otherLocale } from "@/lib/i18n";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Flips the UI between Turkish and English. */
export async function toggleLocaleAction(): Promise<void> {
  const current = await getLocale();
  const next = otherLocale(current);

  const store = await cookies();
  store.set(LOCALE_COOKIE, next, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
  });

  refresh();
}
