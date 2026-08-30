import "server-only";

import { cookies } from "next/headers";

import { LOCALE_COOKIE } from "@/lib/constants";
import type { Locale } from "@/types/domain";

import { DEFAULT_LOCALE, getDictionary, isLocale, type Dictionary } from "./index";

/** Reads the UI language from its cookie, falling back to `DEFAULT_LOCALE`. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getTranslations(): Promise<{ locale: Locale; dict: Dictionary }> {
  const locale = await getLocale();
  return { locale, dict: getDictionary(locale) };
}
