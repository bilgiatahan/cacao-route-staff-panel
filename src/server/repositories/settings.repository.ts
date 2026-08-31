import "server-only";

import type { AppSettings } from "@/types/domain";
import type { AppSettingsModel as AppSettingsRow } from "@/generated/prisma/models";

import { prisma } from "../db/client";

/**
 * The settings row is a singleton, so its primary key is a constant rather than
 * something a caller picks. The column exists to make the one row addressable.
 */
const SETTINGS_ID = "app";

/**
 * What the panel does before an admin has ever opened Settings.
 *
 * `true` is the pre-feature behaviour: every staff screen showed pay, and a
 * migration that silently hid it from everyone would be a change nobody asked
 * for. Turning it off is a decision, so it has to be made.
 */
export const DEFAULT_APP_SETTINGS: AppSettings = { staffCanSeePay: true };

function toAppSettings(row: AppSettingsRow): AppSettings {
  return { staffCanSeePay: row.staffCanSeePay };
}

export const settingsRepository = {
  /**
   * Never null: a missing row means "nothing has been configured yet", which is
   * the defaults, not an error. Every caller reads this on a normal render, so
   * making them each handle an absent row would be a null check in a dozen
   * places with the same answer in all of them.
   */
  async get(): Promise<AppSettings> {
    const row = await prisma.appSettings.findUnique({ where: { id: SETTINGS_ID } });
    return row ? toAppSettings(row) : DEFAULT_APP_SETTINGS;
  },

  /**
   * Upsert, for the same reason: the first save is also the row's creation, and
   * splitting that into "read, then create or update" would leave a race between
   * two admins saving at once.
   */
  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const row = await prisma.appSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...DEFAULT_APP_SETTINGS, ...patch },
      update: patch,
    });
    return toAppSettings(row);
  },
};
