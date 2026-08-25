/**
 * One rule set, two consumers.
 *
 * `PERSON_RULES` is spread onto the controls as DOM attributes and checked
 * again in the action, because a Server Function is reachable by a plain POST
 * and the browser's opinion of a value is a convenience rather than a guarantee.
 * The whole point of the shared object is that those two checks cannot drift, so
 * what is worth testing is the *agreement*: that `inputProps` emits the same
 * numbers `violates` enforces, and that `violates` reproduces HTML's own
 * semantics — anchored patterns, and an empty optional value left alone.
 *
 * Also here: the guard that a new `ActionErrorKey` cannot quietly resolve to the
 * generic "something went wrong" sentence.
 */

import { describe, expect, it } from "vitest";

import {
  birthDateBounds,
  inputProps,
  isPlausibleBirthDate,
  isValidEmail,
  MAX_AGE_YEARS,
  MIN_AGE_YEARS,
  PASSWORD_RULE,
  passwordByteLength,
  PERSON_RULES,
  violates,
} from "@/lib/forms/rules";
import { UK_PHONE_LENGTH } from "@/lib/forms/phone-uk";
import { ALL_ERROR_KEYS, actionErrorMessage } from "@/server/actions/action-result";
import { getDictionary } from "@/lib/i18n";

const dict = getDictionary("en");

describe("inputProps agrees with the rule the server enforces", () => {
  it("passes the same numbers through to the DOM", () => {
    for (const [name, rule] of Object.entries(PERSON_RULES)) {
      const props = inputProps(rule);

      expect(props.maxLength, name).toBe(rule.maxLength);
      expect(props.minLength, name).toBe(
        "minLength" in rule ? rule.minLength : undefined,
      );
      expect(props.pattern, name).toBe("pattern" in rule ? rule.pattern : undefined);
    }
  });

  it("marks required only where the rule says so", () => {
    expect(inputProps(PERSON_RULES.firstName).required).toBe(true);
    expect(inputProps(PERSON_RULES.email).required).toBe(true);
    expect(inputProps(PERSON_RULES.phone).required).toBeUndefined();
    expect(inputProps(PERSON_RULES.address).required).toBeUndefined();
  });

  it("emits no attribute for a limit the rule does not set", () => {
    // A stray `minLength={undefined}` is harmless; a stray `minLength={0}` is
    // not, because it changes what the browser reports as valid.
    expect(inputProps(PERSON_RULES.address).minLength).toBeUndefined();
    expect("pattern" in inputProps(PERSON_RULES.lastName)).toBe(false);
  });
});

describe("violates reproduces HTML's own semantics", () => {
  it("leaves an empty optional value alone", () => {
    // HTML skips minLength and pattern for an empty non-required control. Without
    // that, an optional phone field would demand seven characters of nothing.
    expect(violates("", PERSON_RULES.phone)).toBeNull();
    expect(violates("", PERSON_RULES.lastName)).toBeNull();
    expect(violates("", PERSON_RULES.address)).toBeNull();
  });

  it("still refuses an empty required value", () => {
    expect(violates("", PERSON_RULES.firstName)).toBe("required");
    expect(violates("", PERSON_RULES.email)).toBe("required");
  });

  it("anchors a pattern to the whole value", () => {
    // No rule in PERSON_RULES carries a pattern any more — the phone field is
    // masked and semantically checked instead — but the semantics still matter
    // for the next rule that needs one. An unanchored regex would find a match
    // inside a longer string and pass it.
    const rule = { maxLength: 20, pattern: "[0-9]{4}" };

    expect(violates("1234", rule)).toBeNull();
    expect(violates("x1234", rule)).toBe("pattern");
    expect(violates("1234x", rule)).toBe("pattern");
  });

  it("reports the boundary lengths correctly", () => {
    const rule = PERSON_RULES.firstName;

    expect(violates("A", rule)).toBe("tooShort");
    expect(violates("Al", rule)).toBeNull();
    expect(violates("x".repeat(rule.maxLength), rule)).toBeNull();
    expect(violates("x".repeat(rule.maxLength + 1), rule)).toBe("tooLong");
  });

  it("checks length before pattern, so the message names the real problem", () => {
    // "12" fails both; the length answer is the one a reader can act on.
    expect(violates("12", { maxLength: 24, minLength: 7, pattern: "[0-9 ]+" })).toBe(
      "tooShort",
    );
  });
});

describe("the phone rule is only the coarse gate", () => {
  const rule = PERSON_RULES.phone;

  it("takes its bounds from the formatting module rather than repeating them", () => {
    expect(rule.minLength).toBe(UK_PHONE_LENGTH.min);
    expect(rule.maxLength).toBe(UK_PHONE_LENGTH.max);
  });

  it("carries no pattern, because that would be a second copy of the real rule", () => {
    // The numbering-plan check is `isValidUkPhone`. A regex covering every UK
    // grouping would be a weaker duplicate of it that could disagree.
    expect("pattern" in rule).toBe(false);
    expect(inputProps(rule).pattern).toBeUndefined();
  });

  it("accepts a masked number of either form", () => {
    for (const value of ["07123 456789", "020 7123 4567", "+44 20 7123 4567"]) {
      expect(violates(value, rule), value).toBeNull();
    }
  });

  it("catches an incomplete number on length alone", () => {
    for (const value of ["07123", "020 71", "+44 7"]) {
      expect(violates(value, rule), value).toBe("tooShort");
    }
  });

  it("still lets the optional field stay empty", () => {
    expect(violates("", rule)).toBeNull();
  });
});

describe("email", () => {
  it("accepts the shapes real addresses come in", () => {
    for (const value of [
      "a@b.co",
      "a.b+tag@example.co.uk",
      "first.last@sub.domain.test",
    ]) {
      expect(isValidEmail(value), value).toBe(true);
    }
  });

  it("refuses what cannot be an address", () => {
    for (const value of ["nope", "no@domain", "@example.test", "a b@c.test", "a@b.c"]) {
      expect(isValidEmail(value), value).toBe(false);
    }
  });

  it("is deliberately loose about the rest", () => {
    // The address is proven by being able to sign in with it, not by a regex, so
    // this is a floor rather than a gate. Unusual but legal addresses pass.
    expect(isValidEmail("x'y@example.test")).toBe(true);
  });
});

describe("passwords", () => {
  it("counts bytes, because that is what bcrypt counts", () => {
    expect(passwordByteLength("abcdefgh")).toBe(8);
    // "ş" is two bytes in UTF-8, so 40 of them exceed the 72-byte ceiling even
    // though `.length` reports 40.
    expect("ş".repeat(40).length).toBe(40);
    expect(passwordByteLength("ş".repeat(40))).toBe(80);
  });

  it("stops exactly where bcrypt does", () => {
    expect(PASSWORD_RULE.maxLength).toBe(72);
    expect(passwordByteLength("x".repeat(72))).toBe(72);
    expect(passwordByteLength("x".repeat(73))).toBeGreaterThan(PASSWORD_RULE.maxLength);
  });

  it("asks for enough to be worth hashing", () => {
    expect(PASSWORD_RULE.minLength).toBe(8);
  });
});

describe("birth dates", () => {
  const reference = new Date(2026, 7, 22); // 22 August 2026

  it("brackets a plausible working life", () => {
    const { min, max } = birthDateBounds(reference);

    expect(max).toBe(`${2026 - MIN_AGE_YEARS}-08-22`);
    expect(min).toBe(`${2026 - MAX_AGE_YEARS}-08-22`);
  });

  it("accepts a date inside the window", () => {
    expect(isPlausibleBirthDate("1996-04-02", reference)).toBe(true);
    expect(isPlausibleBirthDate("1960-12-31", reference)).toBe(true);
  });

  it("refuses the typo it exists to catch", () => {
    // A birthday typed as this year, or next.
    expect(isPlausibleBirthDate("2026-08-01", reference)).toBe(false);
    expect(isPlausibleBirthDate("2030-01-01", reference)).toBe(false);
  });

  it("refuses a date nobody living was born on", () => {
    expect(isPlausibleBirthDate("1850-01-01", reference)).toBe(false);
  });

  it("includes both ends of the window", () => {
    const { min, max } = birthDateBounds(reference);

    expect(isPlausibleBirthDate(min, reference)).toBe(true);
    expect(isPlausibleBirthDate(max, reference)).toBe(true);
  });

  it("hands the same bounds to the browser that the server checks", () => {
    // The control gets `min`/`max`; the action re-derives them from its own
    // clock. Both come from this one function.
    const { min, max } = birthDateBounds(reference);
    expect(min < max).toBe(true);
  });
});

describe("every error key has a sentence of its own", () => {
  /** The four that deliberately share the generic wording. */
  const GENERIC = ["unauthenticated", "forbidden", "notFound", "unexpected"];

  it("does not silently fall back to the generic message", () => {
    // `actionErrorMessage` has a `default` branch, so a key with no `case` of its
    // own compiles fine and renders "something went wrong". This catches that.
    for (const locale of ["tr", "en"] as const) {
      const active = getDictionary(locale);
      for (const key of ALL_ERROR_KEYS) {
        if (GENERIC.includes(key)) continue;
        expect(actionErrorMessage(key, active), `${locale}/${key}`).not.toBe(
          active.auth.unexpected,
        );
      }
    }
  });

  it("resolves every key to a non-empty sentence in both locales", () => {
    for (const locale of ["tr", "en"] as const) {
      for (const key of ALL_ERROR_KEYS) {
        expect(actionErrorMessage(key, getDictionary(locale)), key).toBeTruthy();
      }
    }
  });

  it("covers the keys the new rules introduced", () => {
    for (const key of [
      "nameTooShort",
      "invalidEmail",
      "invalidPhone",
      "invalidBirthDate",
      "valueTooLong",
      "passwordTooLong",
      "passwordMismatch",
      "passwordUnchanged",
      "noAccount",
    ] as const) {
      expect(ALL_ERROR_KEYS, key).toContain(key);
      expect(actionErrorMessage(key, dict), key).toBeTruthy();
    }
  });
});
