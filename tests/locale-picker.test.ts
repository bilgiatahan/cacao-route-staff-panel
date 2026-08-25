/**
 * The language switch.
 *
 * The globe button that flipped to "the other" language became a two-flag
 * picker, and with it the action changed shape: `setLocaleAction` selects a
 * named locale instead of toggling. That swap is worth pinning for one reason in
 * particular — the locale now arrives from the browser as a submitted value, so
 * the action has to refuse anything it does not recognise rather than falling
 * back to a default. A malformed POST must leave the cookie alone, not quietly
 * move someone to Turkish.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALE_COOKIE } from "@/lib/constants";

const set = vi.fn();
const get = vi.fn();
const refresh = vi.fn();

vi.mock("next/cache", () => ({ refresh: () => refresh() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set, get }),
}));

const { setLocaleAction, toggleLocaleAction } = await import(
  "@/server/actions/locale.actions"
);
const { LOCALES, DEFAULT_LOCALE, isLocale, otherLocale } = await import("@/lib/i18n");
const { getDictionary } = await import("@/lib/i18n");

/** What a form with `<button name="locale" value="…">` actually posts. */
function submitted(value: string | null): FormData {
  const data = new FormData();
  if (value !== null) data.set("locale", value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  get.mockReturnValue({ value: "tr" });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("setLocaleAction", () => {
  it("writes the language that was chosen", async () => {
    await setLocaleAction(submitted("en"));

    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(
      LOCALE_COOKIE,
      "en",
      expect.objectContaining({ path: "/", sameSite: "lax" }),
    );
  });

  it("can select the language that is already showing", async () => {
    // Pressing the active chip is a no-op to the reader but must not error, and
    // must not flip them somewhere else the way a toggle would.
    await setLocaleAction(submitted("tr"));

    expect(set).toHaveBeenCalledWith(LOCALE_COOKIE, "tr", expect.anything());
  });

  it("handles every locale the picker offers", async () => {
    for (const locale of LOCALES) {
      set.mockClear();
      await setLocaleAction(submitted(locale));
      expect(set, locale).toHaveBeenCalledWith(LOCALE_COOKIE, locale, expect.anything());
    }
  });

  it("refuses a value it does not recognise", async () => {
    for (const bad of ["de", "TR", "", "tr,en", "../../etc", "null"]) {
      set.mockClear();
      await setLocaleAction(submitted(bad));
      expect(set, bad).not.toHaveBeenCalled();
    }
  });

  it("refuses a submission with no locale at all", async () => {
    await setLocaleAction(submitted(null));

    expect(set).not.toHaveBeenCalled();
  });

  it("does not fall back to the default when the value is junk", async () => {
    // The tempting bug: `isLocale(x) ? x : DEFAULT_LOCALE`. That would move an
    // English reader to Turkish on a malformed request.
    await setLocaleAction(submitted("klingon"));

    expect(set).not.toHaveBeenCalled();
    expect(isLocale(DEFAULT_LOCALE)).toBe(true);
  });

  it("re-renders only when something was written", async () => {
    await setLocaleAction(submitted("en"));
    expect(refresh).toHaveBeenCalledTimes(1);

    refresh.mockClear();
    await setLocaleAction(submitted("nope"));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("keeps the cookie for a year, on every path", async () => {
    await setLocaleAction(submitted("en"));

    const [, , options] = set.mock.calls[0];
    expect(options.maxAge).toBe(60 * 60 * 24 * 365);
    expect(options.path).toBe("/");
  });
});

describe("toggleLocaleAction still works for the login screen", () => {
  it("flips away from the current language", async () => {
    get.mockReturnValue({ value: "tr" });
    await toggleLocaleAction();
    expect(set).toHaveBeenCalledWith(LOCALE_COOKIE, "en", expect.anything());

    set.mockClear();
    get.mockReturnValue({ value: "en" });
    await toggleLocaleAction();
    expect(set).toHaveBeenCalledWith(LOCALE_COOKIE, "tr", expect.anything());
  });

  it("treats an unset cookie as the default and flips from there", async () => {
    get.mockReturnValue(undefined);
    await toggleLocaleAction();

    expect(set).toHaveBeenCalledWith(
      LOCALE_COOKIE,
      otherLocale(DEFAULT_LOCALE),
      expect.anything(),
    );
  });
});

describe("the labels the picker renders", () => {
  it("offers exactly two languages, so a two-chip switch is the whole set", () => {
    expect(LOCALES).toEqual(["tr", "en"]);
  });

  it("names each language in itself, identically in both locales", () => {
    // Autonyms: "Türkçe" is "Türkçe" whatever the surrounding UI language is, so
    // the two dictionaries agreeing here is correct rather than a copy-paste slip.
    for (const locale of LOCALES) {
      const { menu } = getDictionary(locale);
      expect(menu.localeTr).toBe("Türkçe");
      expect(menu.localeEn).toBe("English");
      expect(menu.language).toBeTruthy();
    }
  });

  it("has a code for every language it names", () => {
    for (const locale of LOCALES) {
      const { menu } = getDictionary(locale);
      const names: Record<string, string> = {
        tr: menu.localeTr,
        en: menu.localeEn,
      };
      for (const code of LOCALES) {
        expect(names[code], `${locale} → ${code}`).toBeTruthy();
      }
    }
  });
});
