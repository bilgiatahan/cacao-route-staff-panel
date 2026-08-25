/**
 * UK phone formatting and validation.
 *
 * The mask in the browser and the check in the action both come from this
 * module, so it is the one place the two could go wrong together — and the place
 * where the awkward cases live. Two categories matter:
 *
 *   1. **Grouping follows the area code, not the length.** `020 7123 4567` and
 *      `01234 567890` are both eleven digits and neither groups like the other.
 *   2. **Partial input.** A mask formats on every keystroke, so `+4` and `07123`
 *      have to be stable states rather than something the formatter "completes".
 */

import { describe, expect, it } from "vitest";

import {
  formatUkNational,
  formatUkPhone,
  groupingFor,
  isValidUkPhone,
  parseUkPhone,
  UK_NATIONAL_LENGTH,
  UK_PHONE_LENGTH,
  ukNationalTemplate,
  ukPhoneDigits,
} from "@/lib/forms/phone-uk";

describe("grouping follows the area code", () => {
  it("gives a mobile a 5+6 national shape", () => {
    expect(formatUkPhone("07123456789")).toBe("07123 456789");
    expect(groupingFor("7123456789")).toEqual([4, 6]);
  });

  it("gives London and the other 02x codes 3+4+4", () => {
    expect(formatUkPhone("02071234567")).toBe("020 7123 4567");
    expect(formatUkPhone("02890123456")).toBe("028 9012 3456");
    expect(groupingFor("2071234567")).toEqual([2, 4, 4]);
  });

  it("gives the four-digit geographic codes 4+3+4", () => {
    // 0113 Leeds, 0121 Birmingham, 0161 Manchester, 0191 Tyneside.
    expect(formatUkPhone("01134960000")).toBe("0113 496 0000");
    expect(formatUkPhone("01214960000")).toBe("0121 496 0000");
    expect(formatUkPhone("01614960000")).toBe("0161 496 0000");
    expect(formatUkPhone("01914980000")).toBe("0191 498 0000");
  });

  it("gives the five-digit geographic codes 5+6", () => {
    expect(formatUkPhone("01234567890")).toBe("01234 567890");
    expect(formatUkPhone("01865123456")).toBe("01865 123456");
  });

  it("gives non-geographic ranges 4+3+4", () => {
    expect(formatUkPhone("03001234567")).toBe("0300 123 4567");
    expect(formatUkPhone("08001234567")).toBe("0800 123 4567");
    expect(formatUkPhone("09091234567")).toBe("0909 123 4567");
  });

  it("does not group an eleven-digit number the same way twice", () => {
    // The reason the rules key off the code rather than counting from the end.
    expect(formatUkPhone("02071234567")).not.toBe(formatUkPhone("01234567890"));
    expect(ukPhoneDigits("02071234567")).toHaveLength(10);
    expect(ukPhoneDigits("01234567890")).toHaveLength(10);
  });
});

describe("international form", () => {
  it("drops the trunk zero and keeps the country code", () => {
    expect(formatUkPhone("+447123456789")).toBe("+44 7123 456789");
    expect(formatUkPhone("+442071234567")).toBe("+44 20 7123 4567");
  });

  it("accepts the 00 prefix as the same thing", () => {
    expect(formatUkPhone("00447123456789")).toBe("+44 7123 456789");
    expect(formatUkPhone("0044 20 7123 4567")).toBe("+44 20 7123 4567");
  });

  it("groups the national number identically in both forms", () => {
    // "020 7123 4567" and "+44 20 7123 4567" are the same digits either way.
    expect(ukPhoneDigits("020 7123 4567")).toBe(ukPhoneDigits("+44 20 7123 4567"));
    expect(ukPhoneDigits("07123 456789")).toBe(ukPhoneDigits("+44 7123 456789"));
  });

  it("does not strip a leading zero that is part of the area code", () => {
    // "+44 20 …" has no trunk prefix to remove; taking one would eat the "2".
    expect(parseUkPhone("+442071234567").nsn).toBe("2071234567");
  });
});

describe("partial input is a stable state", () => {
  it("leaves a number shorter than its first group alone", () => {
    for (const value of ["0", "07", "071", "0712", "07123"]) {
      expect(formatUkPhone(value), value).toBe(value);
    }
  });

  it("introduces a separator only once the digit after it exists", () => {
    expect(formatUkPhone("071234")).toBe("07123 4");
    expect(formatUkPhone("0207")).toBe("020 7");
  });

  it("keeps a half-typed country code half-typed", () => {
    // The bug this pins: "+4" becoming "+44 4", so the 4 the user meant as the
    // country code turns into the first digit of a national number.
    expect(formatUkPhone("+")).toBe("+");
    expect(formatUkPhone("+4")).toBe("+4");
    expect(formatUkPhone("+44")).toBe("+44 ");
    expect(formatUkPhone("+447")).toBe("+44 7");
  });

  it("is idempotent, so reformatting on every keystroke changes nothing", () => {
    for (const value of [
      "07123 456789",
      "020 7123 4567",
      "+44 20 7123 4567",
      "07123 4",
      "+44 ",
      "0",
      "",
    ]) {
      expect(formatUkPhone(formatUkPhone(value)), value).toBe(formatUkPhone(value));
    }
  });

  it("survives an empty value", () => {
    expect(formatUkPhone("")).toBe("");
    expect(formatUkPhone("   ")).toBe("");
  });

  it("ignores punctuation and spacing already in the value", () => {
    expect(formatUkPhone("(020) 7123-4567")).toBe("020 7123 4567");
    expect(formatUkPhone("07123   456789")).toBe("07123 456789");
  });

  it("stops at ten national digits rather than growing forever", () => {
    expect(ukPhoneDigits("0712345678901234")).toHaveLength(10);
  });
});

describe("a number from somewhere else is shown, not reshaped", () => {
  it("leaves a non-UK international number as typed", () => {
    // Reformatting "+90 532 118 4407" into a UK grouping would claim it is a UK
    // number. Better to show it and reject it.
    expect(formatUkPhone("+905321184407")).toBe("+905321184407");
    expect(parseUkPhone("+905321184407").foreign).toBe(true);
  });

  it("refuses it", () => {
    expect(isValidUkPhone("+90 532 118 4407")).toBe(false);
    expect(isValidUkPhone("+1 202 555 0100")).toBe(false);
  });
});

describe("validation", () => {
  it("accepts complete UK numbers in any spelling", () => {
    for (const value of [
      "07123456789",
      "07123 456789",
      "+44 7123 456789",
      "0044 7123 456789",
      "020 7123 4567",
      "0113 496 0000",
      "01234 567890",
      "0300 123 4567",
    ]) {
      expect(isValidUkPhone(value), value).toBe(true);
    }
  });

  it("refuses an incomplete number", () => {
    for (const value of ["", "0", "07123", "020 712", "+44 7"]) {
      expect(isValidUkPhone(value), value).toBe(false);
    }
  });

  it("refuses a value with no digits in it", () => {
    expect(isValidUkPhone("call me")).toBe(false);
    expect(isValidUkPhone("+++")).toBe(false);
  });

  it("refuses the unallocated leading ranges", () => {
    // 0 would be a second trunk prefix; the 04 range is not allocated.
    expect(isValidUkPhone("0412345678")).toBe(false);
    expect(isValidUkPhone("0012345678")).toBe(false);
  });

  it("refuses an 02x code that does not exist", () => {
    // Only 020, 023, 024, 028 and 029 are allocated. Without this check a
    // Turkish "(0212) 555 1234" groups into a plausible "021 2555 1234" and
    // passes as a London number.
    expect(isValidUkPhone("(0212) 555 1234")).toBe(false);
    expect(isValidUkPhone("021 2555 1234")).toBe(false);

    for (const second of ["0", "3", "4", "8", "9"]) {
      expect(isValidUkPhone(`02${second}71234567`), second).toBe(true);
    }
    for (const second of ["1", "2", "5", "6", "7"]) {
      expect(isValidUkPhone(`02${second}71234567`), second).toBe(false);
    }
  });

  it("accepts a nine-digit national number", () => {
    // Some ranges are one digit shorter than the usual ten.
    expect(isValidUkPhone("0712345678")).toBe(true);
    expect(ukPhoneDigits("0712345678")).toHaveLength(9);
  });
});

describe("the length bounds the form applies", () => {
  it("are the real extremes of a formatted number", () => {
    expect(UK_PHONE_LENGTH.min).toBe("07123 45678".length);
    expect(UK_PHONE_LENGTH.max).toBe("+44 20 7123 4567".length);
  });

  it("bracket every number the formatter calls valid", () => {
    for (const value of [
      "0712345678",
      "07123456789",
      "+447123456789",
      "02071234567",
      "+442071234567",
      "01134960000",
      "01234567890",
    ]) {
      const formatted = formatUkPhone(value);

      expect(isValidUkPhone(formatted), formatted).toBe(true);
      expect(formatted.length, formatted).toBeGreaterThanOrEqual(UK_PHONE_LENGTH.min);
      expect(formatted.length, formatted).toBeLessThanOrEqual(UK_PHONE_LENGTH.max);
    }
  });
});

/* --------------------------------------------- the +44-prefixed control -- */

describe("the national part, with the dial code kept outside the box", () => {
  it("groups exactly as the full number does, minus the prefix", () => {
    for (const value of ["07123456789", "02071234567", "01134960000", "01234567890"]) {
      expect(`+44 ${formatUkNational(value)}`, value).toBe(
        formatUkPhone(`+44${ukPhoneDigits(value)}`),
      );
    }
  });

  it("accepts either spelling on the way in", () => {
    // Pasting a full number into a box that only shows the national part still
    // has to land correctly grouped.
    expect(formatUkNational("07123 456789")).toBe("7123 456789");
    expect(formatUkNational("+44 7123 456789")).toBe("7123 456789");
    expect(formatUkNational("0044 20 7123 4567")).toBe("20 7123 4567");
    expect(formatUkNational("7123456789")).toBe("7123 456789");
  });

  it("is empty for an empty box, so the form can post an empty string", () => {
    // A bare "+44" would fail as an incomplete number on an optional field.
    expect(formatUkNational("")).toBe("");
    expect(formatUkNational("+44")).toBe("");
    expect(formatUkNational("   ")).toBe("");
  });
});

describe("the template under the caret", () => {
  it("shows the whole shape before anything is typed", () => {
    expect(ukNationalTemplate("")).toBe("____ ______");
  });

  it("follows the area code once the first digits identify it", () => {
    // The reason a single fixed "(___) ___-__-__" cannot be right for the UK:
    // every number is ten digits and they do not group alike.
    expect(ukNationalTemplate("7")).toBe("7___ ______");
    expect(ukNationalTemplate("2")).toBe("2_ ____ ____");
    expect(ukNationalTemplate("11")).toBe("11_ ___ ____");
    expect(ukNationalTemplate("3")).toBe("3__ ___ ____");
  });

  it("keeps the typed digits in place and fills the rest", () => {
    expect(ukNationalTemplate("7123")).toBe("7123 ______");
    expect(ukNationalTemplate("71234")).toBe("7123 4_____");
    expect(ukNationalTemplate("207")).toBe("20 7___ ____");
  });

  it("has no placeholders left once the number is complete", () => {
    for (const value of ["07123456789", "02071234567", "01134960000"]) {
      expect(ukNationalTemplate(value), value).not.toContain("_");
      expect(ukNationalTemplate(value)).toBe(formatUkNational(value));
    }
  });

  it("starts with the value it completes, so the ghost layer lines up", () => {
    // The overlay renders the value transparently and the remainder visibly; if
    // the template did not have the value as its prefix, the underscores would
    // land in the wrong columns.
    for (const value of ["", "7", "7123", "71234", "2", "20", "207", "113"]) {
      const formatted = formatUkNational(value);
      expect(ukNationalTemplate(value).startsWith(formatted), value).toBe(true);
    }
  });
});

describe("the bounds the national box applies", () => {
  it("measure the national part alone", () => {
    // Not `UK_PHONE_LENGTH` minus four: that pair is measured against the
    // *national* spelling ("07123 45678") at one end and the international one
    // ("+44 20 7123 4567") at the other, so no single offset relates them.
    expect(UK_NATIONAL_LENGTH.min).toBe("7123 45678".length);
    expect(UK_NATIONAL_LENGTH.max).toBe("20 7123 4567".length);
    expect(UK_NATIONAL_LENGTH.min).toBeLessThan(UK_NATIONAL_LENGTH.max);
  });

  it("still bracket what the hidden field posts", () => {
    // The box holds the national part; the form posts "+44 " plus it, and that
    // whole string is what the action measures against `PERSON_RULES.phone`.
    for (const value of ["0712345678", "02071234567"]) {
      const posted = `+44 ${formatUkNational(value)}`;

      expect(posted.length, posted).toBeGreaterThanOrEqual(UK_PHONE_LENGTH.min);
      expect(posted.length, posted).toBeLessThanOrEqual(UK_PHONE_LENGTH.max);
      expect(isValidUkPhone(posted), posted).toBe(true);
    }
  });

  it("bracket every national part the formatter produces", () => {
    for (const value of ["0712345678", "07123456789", "02071234567", "01134960000"]) {
      const national = formatUkNational(value);

      expect(national.length, national).toBeGreaterThanOrEqual(UK_NATIONAL_LENGTH.min);
      expect(national.length, national).toBeLessThanOrEqual(UK_NATIONAL_LENGTH.max);
    }
  });
});
