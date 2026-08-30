/**
 * Store opening and closing hours, in minutes from midnight.
 *
 * The only reader left is the timetable's time scale, which draws an hour of
 * margin either side. They were also the basis of a coverage-gap metric, removed
 * because a single pair of hours applied to all seven days could not describe a
 * real week.
 */
/** 07:00 */
export const OPENING_MINUTES = 7 * 60;

/** 19:00 */
export const CLOSING_MINUTES = 19 * 60;

export const CURRENCY_SYMBOL = "£";

/**
 * Locale for money and other numeric formatting. The panel runs in London, so
 * grouping and the decimal separator follow en-GB regardless of the UI
 * language — a price is not translated, it is localised to where it is paid.
 */
export const MONEY_LOCALE = "en-GB";

/** Shown at the foot of the side menu. Bump it with package.json. */
export const APP_VERSION = "1.2.0";

/** Cookie holding the UI language. */
export const LOCALE_COOKIE = "cr_locale";

/** Query params driving the server-rendered views. */
export const SEARCH_PARAM = {
  week: "week",
  view: "view",
  day: "day",
  month: "month",
} as const;
