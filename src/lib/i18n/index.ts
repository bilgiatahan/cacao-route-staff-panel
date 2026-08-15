import type { Locale } from "@/types/domain";
import { en } from "./dictionaries/en";
import { tr } from "./dictionaries/tr";
import type { Dictionary } from "./types";

export const LOCALES: Locale[] = ["tr", "en"];
export const DEFAULT_LOCALE: Locale = "tr";

const DICTIONARIES: Record<Locale, Dictionary> = { tr, en };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

export function isLocale(value: unknown): value is Locale {
  return value === "tr" || value === "en";
}

export function otherLocale(locale: Locale): Locale {
  return locale === "tr" ? "en" : "tr";
}

/** Fills `{placeholder}` slots in a dictionary template. */
export function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export type { Dictionary };
