"use client";

import { useEffect, useId, type RefObject } from "react";

import { DEFAULT_FIELD_MAP, fieldForError, type FieldMap } from "@/lib/forms/field-errors";
import type { ActionErrorKey, ActionResult } from "@/server/actions/action-result";

export interface FieldErrors {
  /** The error when it cannot be attributed to one control. */
  formError: string | null;
  /** The error for one control, or `undefined`. Pass to `Field`'s `error`. */
  errorFor: (name: string) => string | undefined;
  /** Stable id, so `aria-describedby` and the message agree. */
  errorId: (name: string) => string;
  /** Spread onto the control: `aria-invalid` + `aria-describedby` when invalid. */
  controlProps: (name: string) => {
    "aria-invalid"?: true;
    "aria-describedby"?: string;
  };
}

/**
 * Turns one `ActionResult` into either a field-level error or a form-level one.
 *
 * Also moves focus to the offending control after a failed submit — on a form
 * with eleven fields, being told "something is wrong" without being taken there
 * is most of the problem.
 */
export function useFieldErrors(
  /**
   * Owned by the caller and passed in, not created here: a hook that returns a
   * ref alongside render-time helpers reads to the compiler as touching the ref
   * during render.
   */
  formRef: RefObject<HTMLFormElement | null>,
  state: ActionResult | null,
  resolve: (key: ActionErrorKey) => string,
  fieldMap: FieldMap = DEFAULT_FIELD_MAP,
): FieldErrors {
  const id = useId();

  const key = state && !state.ok ? state.error : null;
  const field = key ? fieldForError(key, fieldMap) : null;

  useEffect(() => {
    if (!field) return;
    const control = formRef.current?.elements.namedItem(field);
    if (control instanceof HTMLElement) control.focus();
  }, [field, state, formRef]);

  const errorId = (name: string) => `${id}-${name}-error`;

  return {
    formError: key && !field ? resolve(key) : null,
    errorFor: (name: string) => (key && field === name ? resolve(key) : undefined),
    errorId,
    controlProps: (name: string) =>
      field === name ? { "aria-invalid": true as const, "aria-describedby": errorId(name) } : {},
  };
}
