import "server-only";

import { cache } from "react";

import { settingsRepository } from "../repositories/settings.repository";
import type { AppSettings, SessionUser } from "@/types/domain";

/**
 * Panel settings, read once per request.
 *
 * Wrapped in React's `cache` for the same reason `getSessionUser` is: the
 * layout asks whether to draw the pay tab, the page asks whether to draw the pay
 * card, and both happen inside one render. Without it that is a round trip to
 * Postgres per question. The cache is per-request, so a save takes effect on the
 * very next render.
 */
export const getAppSettings = cache(async (): Promise<AppSettings> => {
  return settingsRepository.get();
});

/**
 * The one place the pay-visibility rule is applied.
 *
 * Every surface that shows money to the signed-in person asks this — the pay tab
 * in both navs, the summary's pay card, the payroll screen itself, and the wage
 * row on Profile — so the rule is written once and the screens cannot disagree
 * about who is allowed to see what. An admin is never gated: they are the ones
 * who set the wage, and hiding it from them would only hide their own figures.
 */
export async function canViewPay(user: SessionUser): Promise<boolean> {
  if (user.role === "admin") return true;
  return (await getAppSettings()).staffCanSeePay;
}
