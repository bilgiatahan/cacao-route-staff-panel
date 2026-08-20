/**
 * Step 5: an action error lands on the control it is about.
 *
 * Server actions return one `ActionErrorKey` and no field name — and they did
 * not need to change. Every key already implies its control (`emailTaken` can
 * only be the email; `wrongPassword` can only be the current password), so the
 * mapping is a pure client-side concern. These tests pin that mapping, including
 * the keys that must deliberately stay form-level.
 *
 * The wiring itself (`aria-invalid`, `aria-describedby`) lives in a hook inside
 * client components; there is no DOM harness in this project and adding one is
 * out of scope, so the contract those attributes are derived from is what is
 * verified here.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_FIELD_MAP,
  FORM_LEVEL_KEYS,
  fieldForError,
  type FieldMap,
} from "@/lib/forms/field-errors";
import { actionErrorMessages } from "@/server/actions/action-result";
import { getDictionary } from "@/lib/i18n";
import type { ActionErrorKey } from "@/server/actions/action-result";

const ALL_KEYS = Object.keys(actionErrorMessages(getDictionary("tr"))) as ActionErrorKey[];

/** The override ProfileForm applies: its password box is `newPassword`. */
const PROFILE_MAP: FieldMap = {
  ...DEFAULT_FIELD_MAP,
  passwordTooShort: "newPassword",
  accountNeedsEmail: null,
};

describe("field attribution", () => {
  it("puts every validation error on a control", () => {
    expect(fieldForError("nameRequired")).toBe("firstName");
    expect(fieldForError("emailRequired")).toBe("email");
    expect(fieldForError("emailTaken")).toBe("email");
    expect(fieldForError("passwordTooShort")).toBe("password");
    expect(fieldForError("currentPasswordRequired")).toBe("currentPassword");
    expect(fieldForError("wrongPassword")).toBe("currentPassword");
    expect(fieldForError("invalidRange")).toBe("startDate");
    expect(fieldForError("invalidTime")).toBe("startTime");
  });

  it("keeps request-level failures off the fields", () => {
    for (const key of FORM_LEVEL_KEYS) {
      expect(fieldForError(key), key).toBeNull();
    }
  });

  it("never pins invalidCredentials to a control", () => {
    // The server does not say which half was wrong; the form must not guess.
    expect(fieldForError("invalidCredentials")).toBeNull();
    expect(FORM_LEVEL_KEYS).toContain("invalidCredentials");
  });

  it("accounts for every key — attributed or explicitly form-level", () => {
    for (const key of ALL_KEYS) {
      const field = fieldForError(key);
      const explained = field !== null || FORM_LEVEL_KEYS.includes(key);
      expect(explained, `${key} is neither mapped nor form-level`).toBe(true);
    }
  });

  it("resolves every attributed key to a real sentence in both locales", () => {
    for (const locale of ["tr", "en"] as const) {
      const messages = actionErrorMessages(getDictionary(locale));
      for (const key of ALL_KEYS) {
        if (fieldForError(key) === null) continue;
        expect(messages[key], `${locale}/${key}`).toBeTruthy();
      }
    }
  });
});

describe("per-form overrides", () => {
  it("sends passwordTooShort to newPassword on the profile form", () => {
    expect(fieldForError("passwordTooShort", PROFILE_MAP)).toBe("newPassword");
    // …and still to `password` on the employee form.
    expect(fieldForError("passwordTooShort")).toBe("password");
  });

  it("lets a form force a key back to form-level with null", () => {
    // On /profile this means "you have no sign-in", not "bad address".
    expect(fieldForError("accountNeedsEmail", PROFILE_MAP)).toBeNull();
    expect(fieldForError("accountNeedsEmail")).toBe("email");
  });

  it("does not let an override leak into the default map", () => {
    expect(DEFAULT_FIELD_MAP.passwordTooShort).toBe("password");
    expect(DEFAULT_FIELD_MAP.accountNeedsEmail).toBe("email");
  });
});

describe("field names match the controls that post them", () => {
  it("uses the same names the server actions read from FormData", () => {
    // `readDraft`/`updateProfileAction` read these keys; a rename on either side
    // would break the association silently, so they are asserted together.
    const posted = [
      "firstName",
      "email",
      "password",
      "newPassword",
      "currentPassword",
      "startDate",
      "startTime",
    ];
    const mapped = new Set(
      [...ALL_KEYS, ...ALL_KEYS].map((k) => fieldForError(k, PROFILE_MAP)).filter(Boolean),
    );
    for (const name of mapped) {
      expect(posted, `${name} is not a control the actions read`).toContain(name);
    }
  });
});
