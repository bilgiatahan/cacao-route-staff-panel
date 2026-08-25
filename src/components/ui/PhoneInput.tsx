"use client";

import { useLayoutEffect, useRef, useState, type ChangeEvent } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";
import { CONTROL_CLASS_SOFT } from "@/components/ui/Field";
import {
  formatUkNational,
  UK_NATIONAL_LENGTH,
  ukNationalTemplate,
} from "@/lib/forms/phone-uk";
import { cn } from "@/lib/utils";

export interface PhoneInputProps {
  /** The field the form posts. Carried by a hidden input holding `+44 …`. */
  name: string;
  /** Any spelling: `07123 456789`, `+44 7123 456789`, or bare digits. */
  defaultValue?: string;
  icon?: IconName;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  className?: string;
}

/** `+44 ` is chrome, not text — the box below never contains it. */
const DIAL_CODE = "+44";

/** How many digits sit before `index` in `value`. */
function digitsBefore(value: string, index: number): number {
  let count = 0;
  for (let at = 0; at < index && at < value.length; at += 1) {
    if (/\d/.test(value[at])) count += 1;
  }
  return count;
}

/** The offset just after the `count`-th digit, so the caret lands on a digit. */
function offsetAfterDigits(value: string, count: number): number {
  if (count === 0) return 0;

  let seen = 0;
  for (let at = 0; at < value.length; at += 1) {
    if (/\d/.test(value[at])) {
      seen += 1;
      if (seen === count) return at + 1;
    }
  }
  return value.length;
}

/**
 * A UK phone field: fixed `+44`, and a template showing the digits still to come.
 *
 * The country code sits **outside** the text box rather than inside it. Every
 * number this panel stores is a UK number, so `+44` is not something anyone
 * should have to type, delete, or be able to break — and keeping it out of the
 * input removes a whole class of bugs at once: no caret can wander into it, no
 * backspace can eat it, and no paste can turn it into `+944`. It is drawn in the
 * brand colour so it reads as part of the control, not as a value.
 *
 * Under the caret is a live template — `____ ______` before anything is typed,
 * `7123 4_____` part way through. It is a ghost layer behind the text, with the
 * typed characters transparent and the rest as underscores, so the two align
 * exactly without measuring anything. `tabular` on both keeps digit widths equal.
 *
 * The template is not one fixed shape, and that is deliberate. Every UK number is
 * ten digits, but they do not group alike: `7123 456789` is a mobile,
 * `20 7123 4567` is London, `113 496 0000` is Leeds. A single `(___) ___-__-__`
 * would be wrong for most of them, so the shape follows the area code as soon as
 * the first digits identify it.
 *
 * The form posts a hidden input holding the whole number, so nothing downstream
 * has to know the field was split — and an empty box posts an empty string, not
 * a bare `+44`, which would otherwise fail as an incomplete number on a field
 * that is optional.
 */
export function PhoneInput({
  name,
  defaultValue = "",
  icon,
  className,
  ...aria
}: PhoneInputProps) {
  /**
   * An object, not the string: a keystroke that leaves the formatted value
   * unchanged — a letter, or an eleventh digit past the cap — would otherwise be
   * identical state, React would skip the re-render, and the caret effect below
   * would never run, leaving a stale offset to be applied on the next keystroke.
   */
  const [state, setState] = useState(() => ({
    value: formatUkNational(defaultValue),
    caret: null as number | null,
  }));

  const ref = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (state.caret === null) return;
    ref.current?.setSelectionRange(state.caret, state.caret);
  }, [state]);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    const previous = state.value;
    const at = event.target.selectionStart ?? raw.length;

    let digits = digitsBefore(raw, at);

    // A deletion that took a separator rather than a digit: the digit count is
    // unchanged, so take the digit in front of it too. Without this the space is
    // removed, reformatting puts it straight back, and the caret sticks.
    const removedSeparator =
      raw.length < previous.length &&
      digitsBefore(raw, raw.length) === digitsBefore(previous, previous.length);

    let next = raw;
    if (removedSeparator && digits > 0) {
      const cut = offsetAfterDigits(raw, digits);
      next = raw.slice(0, cut - 1) + raw.slice(cut);
      digits -= 1;
    }

    const formatted = formatUkNational(next);
    setState({ value: formatted, caret: offsetAfterDigits(formatted, digits) });
  };

  const template = ukNationalTemplate(state.value);
  // Only the part not yet typed; the rest is spaced out by a transparent copy of
  // the value so the underscores land in the right columns.
  const remainder = template.slice(state.value.length);

  return (
    <span className={cn("relative flex items-center", className)}>
      {icon ? (
        <Icon name={icon} className="pointer-events-none absolute left-3 h-4 w-4 text-muted" />
      ) : null}

      {/*
        `aria-hidden`: the code is already in the field's accessible name through
        the hidden input's value and the label, and announcing "plus four four"
        as a separate object would just be noise between the label and the box.
      */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute text-control font-semibold text-brand",
          icon ? "left-9" : "left-3",
        )}
      >
        {DIAL_CODE}
      </span>

      <input
        ref={ref}
        type="tel"
        // A numeric keypad, but still a text field: the separators are part of
        // what is displayed and `type="number"` would refuse them.
        inputMode="tel"
        autoComplete="tel-national"
        value={state.value}
        onChange={onChange}
        // Owned here rather than passed in: the box holds the national part, so
        // the whole-number bounds in `PERSON_RULES` are the wrong measure for it.
        minLength={UK_NATIONAL_LENGTH.min}
        maxLength={UK_NATIONAL_LENGTH.max}
        className={cn(CONTROL_CLASS_SOFT, "tabular", icon ? "pl-[4.5rem]" : "pl-12")}
        {...aria}
      />

      {/* The template, sitting exactly behind the text it completes. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-3 flex items-center",
          "text-control tabular text-muted/70",
          icon ? "left-[4.5rem]" : "left-12",
        )}
      >
        <span className="text-transparent">{state.value}</span>
        <span>{remainder}</span>
      </span>

      {/* What the form actually posts. Empty stays empty: the field is optional,
          and a bare "+44" would fail as an incomplete number. */}
      <input
        type="hidden"
        name={name}
        value={state.value ? `${DIAL_CODE} ${state.value}` : ""}
      />
    </span>
  );
}
