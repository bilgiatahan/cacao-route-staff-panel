/**
 * UK telephone numbers: grouping, formatting and validation.
 *
 * Pure and no I/O, so the mask in the browser and the check in the action run the
 * same code. That matters more here than for a length limit: a mask that groups
 * digits differently from the validator would produce a value the user can see is
 * "right" and the server rejects.
 *
 * The awkward part of UK numbering is that the area code is not a fixed width —
 * Ofcom's plan has 2-, 3-, 4- and 5-digit codes, and the grouping follows the
 * code, not the total length. `020 7123 4567` and `01234 567890` are both eleven
 * digits and neither groups like the other. So the rules below key off the
 * leading digits of the national significant number rather than counting from
 * the end.
 */

/** How the national significant number is grouped, by its leading digits. */
type Grouping = readonly number[];

const MOBILE_AND_LONG_AREA: Grouping = [4, 6]; // 07123 456789 · 01234 567890
const SHORT_AREA: Grouping = [2, 4, 4]; //        020 7123 4567
const FOUR_DIGIT_AREA: Grouping = [3, 3, 4]; //   0113 496 0000 · 0300 123 4567

/** A UK national significant number is 9 or 10 digits, trunk `0` excluded. */
const MIN_NSN_DIGITS = 9;
const MAX_NSN_DIGITS = 10;

/**
 * Ranges that cannot begin a UK number.
 *
 * `0` would be a second trunk prefix and `4` is unallocated. Everything else in
 * 1–9 is in use somewhere, so the check stays a floor rather than an attempt to
 * encode the whole numbering plan — which changes, and would then reject a
 * perfectly dialable number.
 */
const VALID_NSN_START = /^[12356789]/;

/**
 * The allocated two-digit area codes: 020, 023, 024, 028, 029.
 *
 * Worth enumerating where the geographic ranges are not: there are only five,
 * they do not change, and without the check a Turkish `(0212) 555 1234` groups
 * into a plausible-looking `021 2555 1234` and passes as a London number. The
 * 01xxx ranges run to hundreds of codes, so those stay length-checked only —
 * a list that long would go stale and start rejecting real numbers.
 */
const SHORT_AREA_SECOND_DIGIT = /^2[03489]/;

/** The UK's country calling code. */
const UK_CALLING_CODE = "44";

export interface ParsedUkPhone {
  /** Digits of the national significant number, trunk `0` and `+44` removed. */
  nsn: string;
  /** Whether the number is written in international form. */
  international: boolean;
  /**
   * International form for somewhere other than the UK.
   *
   * A `+90` number is not reshaped into a UK grouping — it is shown as typed and
   * rejected. Reformatting it would claim it is a UK number, which is worse than
   * saying it is not one.
   */
  foreign: boolean;
  /** The country-code digits seen so far, for a prefix still being typed. */
  callingCode: string;
}

/**
 * Reduces anything typed into digits, plus how it was written.
 *
 * Accepts the forms that turn up in practice: `07123 456789`, `+44 7123 456789`,
 * `0044 7123 456789`, and a bare `7123 456789` for someone typing after the
 * prefix. A half-typed `+4` stays a half-typed country code rather than becoming
 * the first digit of a national number.
 */
export function parseUkPhone(value: string): ParsedUkPhone {
  const trimmed = value.trim();
  const international = trimmed.startsWith("+") || trimmed.startsWith("00");
  const digits = trimmed.replace(/\D/g, "");

  if (!international) {
    // The trunk prefix. Stripped only here: in `+44 20 …` there is no leading 0,
    // and removing one would eat the area code's first digit.
    const nsn = digits.startsWith("0") ? digits.slice(1) : digits;
    return {
      nsn: nsn.slice(0, MAX_NSN_DIGITS),
      international: false,
      foreign: false,
      callingCode: "",
    };
  }

  const rest = digits.startsWith("00") ? digits.slice(2) : digits;

  if (rest.startsWith(UK_CALLING_CODE)) {
    return {
      nsn: rest.slice(UK_CALLING_CODE.length, UK_CALLING_CODE.length + MAX_NSN_DIGITS),
      international: true,
      foreign: false,
      callingCode: UK_CALLING_CODE,
    };
  }

  // "" or "4" — the code is not finished, so there is no national number yet.
  if (UK_CALLING_CODE.startsWith(rest)) {
    return { nsn: "", international: true, foreign: false, callingCode: rest };
  }

  return { nsn: "", international: true, foreign: true, callingCode: rest };
}

/** Which grouping a national significant number takes. */
export function groupingFor(nsn: string): Grouping {
  // 020, 023, 024, 028, 029 — the two-digit area codes.
  if (nsn.startsWith("2")) return SHORT_AREA;

  // 0113…0119, and the `01x1` codes: 0121, 0131, 0141, 0151, 0161, 0191.
  if (nsn.startsWith("11") || (nsn.startsWith("1") && nsn[2] === "1")) {
    return FOUR_DIGIT_AREA;
  }

  // Non-geographic: 03xx, 05xx, 08xx, 09xx.
  if (/^[3589]/.test(nsn)) return FOUR_DIGIT_AREA;

  // Mobiles (07…) and the five-digit geographic codes (01xxx).
  return MOBILE_AND_LONG_AREA;
}

/** Splits digits into the given groups, keeping a partial trailing group. */
function chunk(digits: string, grouping: Grouping): string[] {
  const parts: string[] = [];
  let index = 0;

  for (const size of grouping) {
    if (index >= digits.length) break;
    parts.push(digits.slice(index, index + size));
    index += size;
  }

  // Anything past the last group — only reachable on a malformed long input.
  if (index < digits.length) parts.push(digits.slice(index));

  return parts;
}

/**
 * Formats as far as the digits go, so the mask works while someone is typing.
 *
 * "07" stays "07", "07123" stays "07123", "071234" becomes "07123 4". Nothing is
 * padded or guessed — the separator appears only once the digit that follows it
 * has been typed.
 */
export function formatUkPhone(value: string): string {
  const { nsn, international, foreign, callingCode } = parseUkPhone(value);

  // Somewhere other than the UK: shown as typed, not reshaped.
  if (foreign) return `+${callingCode}`;

  if (!nsn) {
    if (!international) return value.trim().startsWith("0") ? "0" : "";
    // A finished code gets its separating space; a half-typed one does not, so
    // "+4" stays "+4" instead of jumping to "+44 4".
    return callingCode === UK_CALLING_CODE ? `+${UK_CALLING_CODE} ` : `+${callingCode}`;
  }

  const [first, ...rest] = chunk(nsn, groupingFor(nsn));

  if (international) return [`+${UK_CALLING_CODE}`, first, ...rest].join(" ");
  // In national form the trunk `0` joins the area code rather than standing
  // alone: `020 7123 4567`, not `0 20 7123 4567`.
  return [`0${first}`, ...rest].join(" ");
}

/** Whether a value is a complete, dialable UK number. */
export function isValidUkPhone(value: string): boolean {
  const { nsn, foreign } = parseUkPhone(value);

  if (foreign) return false;
  if (nsn.length < MIN_NSN_DIGITS || nsn.length > MAX_NSN_DIGITS) return false;
  if (!VALID_NSN_START.test(nsn)) return false;
  // A 2-prefixed number has to be one of the five real short area codes.
  if (nsn.startsWith("2") && !SHORT_AREA_SECOND_DIGIT.test(nsn)) return false;

  return true;
}

/** The digits alone, for comparing two spellings of the same number. */
export function ukPhoneDigits(value: string): string {
  return parseUkPhone(value).nsn;
}

/* ------------------------------------------------ the +44-prefixed control -- */

/** Stands in for a digit not yet typed. */
export const PHONE_PLACEHOLDER = "_";

/**
 * The national part alone, grouped, with no `+44` in front.
 *
 * `PhoneInput` keeps the country code outside the text box — it is fixed, so it
 * is chrome rather than something to type — and this formats what is left. Accepts
 * either spelling on the way in, so pasting a full `+44 …` or `07…` number into
 * the box still lands correctly grouped.
 */
export function formatUkNational(value: string): string {
  const { nsn } = parseUkPhone(value);
  if (!nsn) return "";

  return chunk(nsn, groupingFor(nsn)).join(" ");
}

/**
 * The same grouping with `_` where the digits are still missing.
 *
 * Drawn under the caret as a live template, so the shape of the number is
 * visible before it is typed. It changes once the area code is known: every UK
 * grouping is ten digits, but `20 7123 4567` and `7123 456789` are not the same
 * shape, and pretending otherwise is what a single fixed template would do.
 */
export function ukNationalTemplate(value: string): string {
  const { nsn } = parseUkPhone(value);
  const grouping = groupingFor(nsn);
  const total = grouping.reduce((sum, size) => sum + size, 0);

  return chunk(nsn.padEnd(total, PHONE_PLACEHOLDER), grouping).join(" ");
}

/**
 * Bounds for the national box, as `PERSON_RULES` holds them for the whole value.
 *
 * Shorter than `UK_PHONE_LENGTH` by the four characters of `+44 `, which the box
 * no longer contains.
 */
export const UK_NATIONAL_LENGTH = {
  /** "7123 45678" — a 9-digit number grouped in two. */
  min: formatUkNational("0712345678").length,
  /** "20 7123 4567" — a 10-digit number grouped in three. */
  max: formatUkNational("02071234567").length,
} as const;

/**
 * Shortest and longest a complete formatted number can be.
 *
 * Run through `formatUkPhone` rather than typed in, so the numbers cannot drift
 * from the grouping rules they describe. The two extremes are a 9-digit NSN in
 * national form with two groups, and a 10-digit one in `+44` form with three.
 */
export const UK_PHONE_LENGTH = {
  /** "07123 45678" — 11 characters. */
  min: formatUkPhone("0712345678").length,
  /** "+44 20 7123 4567" — 16 characters. */
  max: formatUkPhone("+442071234567").length,
} as const;
