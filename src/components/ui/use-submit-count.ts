"use client";

import { useState } from "react";

export interface SubmitCountState {
  /** Completed submissions so far. */
  count: number;
  wasPending: boolean;
}

/**
 * The counter's whole state machine, as a pure function.
 *
 * Split out from the hook so the sequence that actually broke — submit, resolve,
 * submit again with an identical result — is testable without a DOM harness,
 * which this project does not have.
 *
 * Counted on the falling edge: a submission *completing* is when there is a new
 * result to report, and counting starts instead would advance the number while
 * the old outcome was still the one on screen.
 */
export function advanceSubmitCount(
  state: SubmitCountState,
  pending: boolean,
): SubmitCountState {
  if (pending === state.wasPending) return state;
  return { wasPending: pending, count: pending ? state.count : state.count + 1 };
}

/**
 * How many times an action has finished.
 *
 * `useActionState` holds its last result indefinitely, and `ACTION_OK` is a
 * single shared object, so two successful saves in a row leave the state
 * *identical*: same reference, same message, no transition anywhere. Anything
 * that reports an outcome by watching the result therefore fires once and never
 * again — which is how the success toast came to appear on the first save and
 * stay silent on every one after it.
 *
 * This turns that standing state back into an event. The count changes on every
 * round trip even when the result does not, which is the signal a toast needs to
 * reappear with the same words.
 *
 * State is adjusted during render rather than in an effect: `pending` is an
 * input and this is derived from it, which is the case React documents the
 * pattern for. Writing `wasPending` in the same branch makes the condition false
 * on the next render, so it settles immediately.
 */
export function useSubmitCount(pending: boolean): number {
  const [state, setState] = useState<SubmitCountState>(() => ({
    count: 0,
    wasPending: pending,
  }));

  if (pending !== state.wasPending) setState(advanceSubmitCount(state, pending));

  return state.count;
}
