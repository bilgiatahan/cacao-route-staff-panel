import { isValidIsoDate } from "@/lib/date";
import { isValidUkPhone } from "@/lib/forms/phone-uk";
import {
  isPlausibleBirthDate,
  isValidEmail,
  PERSON_RULES,
  violates,
  type TextRule,
} from "@/lib/forms/rules";
import { actionError, type ActionErrorKey, type ActionResult } from "@/server/actions/action-result";
import type { IsoDate } from "@/types/domain";

/**
 * The one validator for a person's details.
 *
 * Two forms edit these fields — `ProfileForm`, where you edit your own, and
 * `EmployeeForm`, where the manager edits anyone's — and before this existed only
 * the first of them checked anything. So a manager could store a phone number
 * its owner would then be unable to save, which is a worse failure than either
 * form rejecting it: the person is locked out of their own record by data
 * somebody else entered.
 *
 * `PERSON_RULES` says how long a value may be; this says which error key each
 * violation earns, and in what order the fields are checked. Both halves live
 * outside the actions so neither action can hold a private opinion about them.
 */

/** Turns a rule violation into the key that points at the right control. */
function ruleError(
  value: string,
  rule: TextRule,
  keys: { required?: ActionErrorKey; tooShort?: ActionErrorKey; pattern?: ActionErrorKey },
): ActionResult | null {
  const violation = violates(value, rule);
  if (!violation) return null;

  switch (violation) {
    case "required":
      return actionError(keys.required ?? "unexpected");
    case "tooShort":
      return actionError(keys.tooShort ?? "unexpected");
    case "tooLong":
      // Native `maxLength` already stops this in the browser, so arriving here
      // means the value did not come from the form.
      return actionError("valueTooLong");
    case "pattern":
      return actionError(keys.pattern ?? "unexpected");
  }
}

export interface PersonFields {
  firstName: string;
  lastName: string;
  /** Only the manager's form has a job title; the profile form omits it. */
  position?: string;
  email: string;
  phone: string;
  address: string;
  /** Already narrowed to a valid ISO date, or `null` for "not set". */
  birthDate: IsoDate | null;
}

export interface PersonFieldOptions {
  /**
   * Whether a blank email is a failure.
   *
   * True on the profile form, where the address *is* the sign-in and clearing it
   * would lock the person out of the panel they are standing in. False on the
   * manager's form, where a roster row can legitimately have no account at all —
   * a task row like "Cleaning", or someone whose login is set up later.
   */
  emailRequired: boolean;
}

/**
 * The first rule these values break, or `null` when they are all satisfied.
 *
 * Ordered roughly the way the fields are read on screen, so when several are
 * wrong the reported one is the earliest the reader would have reached.
 */
export function checkPersonFields(
  values: PersonFields,
  { emailRequired }: PersonFieldOptions,
): ActionResult | null {
  const firstName = ruleError(values.firstName, PERSON_RULES.firstName, {
    required: "nameRequired",
    tooShort: "nameTooShort",
  });
  if (firstName) return firstName;

  const lastName = ruleError(values.lastName, PERSON_RULES.lastName, {});
  if (lastName) return lastName;

  if (values.position !== undefined) {
    const position = ruleError(values.position, PERSON_RULES.position, {});
    if (position) return position;
  }

  if (!values.email) {
    if (emailRequired) return actionError("emailRequired");
  } else {
    const email = ruleError(values.email, PERSON_RULES.email, {});
    if (email) return email;
    if (!isValidEmail(values.email)) return actionError("invalidEmail");
  }

  // Length first, so an unfinished number says it is unfinished; then the
  // numbering plan, which is the rule the mask in the browser is drawn from.
  const phone = ruleError(values.phone, PERSON_RULES.phone, { tooShort: "invalidPhone" });
  if (phone) return phone;
  if (values.phone && !isValidUkPhone(values.phone)) return actionError("invalidPhone");

  const address = ruleError(values.address, PERSON_RULES.address, {});
  if (address) return address;

  if (values.birthDate && !isPlausibleBirthDate(values.birthDate)) {
    return actionError("invalidBirthDate");
  }

  return null;
}

/**
 * A date field's value, or `null`.
 *
 * A malformed date is `null` rather than an error: the control is a native date
 * picker, so an unparseable value did not come from a person choosing a day, and
 * clearing the field is a legitimate edit. An implausible but well-formed date is
 * a different matter — that is a typo, and `checkPersonFields` reports it.
 */
export function readIsoDate(value: string): IsoDate | null {
  return isValidIsoDate(value) ? value : null;
}
