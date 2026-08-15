/** Store opening hour, in minutes from midnight (07:00). */
export const OPENING_MINUTES = 7 * 60;

/** Store closing hour, in minutes from midnight (19:00). */
export const CLOSING_MINUTES = 19 * 60;

/**
 * A day counts as a coverage gap when nobody clocks in within this grace
 * window after opening, or when the last clock-out lands before closing.
 */
export const OPENING_GRACE_MINUTES = 60;

/** Weekly hours after which overtime pay kicks in. */
export const OVERTIME_THRESHOLD_HOURS = 45;

/** Multiplier applied to the hourly rate for overtime hours. */
export const OVERTIME_MULTIPLIER = 1.5;

export const CURRENCY_SYMBOL = "₺";

/** Shown at the foot of the side menu. Bump it with package.json. */
export const APP_VERSION = "1.2.0";

/** Cookie holding the UI language. */
export const LOCALE_COOKIE = "cr_locale";

/** Query params driving the server-rendered views. */
export const SEARCH_PARAM = {
  week: "week",
  view: "view",
  day: "day",
} as const;
