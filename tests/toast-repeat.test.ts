/**
 * A toast has to appear again when it says the same thing twice.
 *
 * The bug this pins, exactly as it was reported: the first save showed
 * "Bilgilerin kaydedildi.", every save after it showed nothing, even though the
 * action succeeded every time.
 *
 * The cause was that neither half of the message's identity ever changed.
 * `ACTION_OK` is one shared object, so `useActionState` holds the *same
 * reference* after every success, which produces the *same sentence* — and the
 * toast, which reset itself only when the message differed, could not tell "said
 * again" from "still showing" and stayed dismissed.
 *
 * So what is tested here is the counter that supplies the missing identity, and
 * the reset rule that consumes it, walked through the real sequence.
 */

import { describe, expect, it } from "vitest";

import {
  advanceSubmitCount,
  type SubmitCountState,
} from "@/components/ui/use-submit-count";
import { ACTION_OK, actionError } from "@/server/actions/action-result";

const idle = (pending = false): SubmitCountState => ({ count: 0, wasPending: pending });

/** One submission: pending goes up, then comes back down. */
function submit(state: SubmitCountState): SubmitCountState {
  return advanceSubmitCount(advanceSubmitCount(state, true), false);
}

describe("the state that made the bug possible", () => {
  it("hands back the very same object for every success", () => {
    // Not a quirk to work around — it is why the message cannot be the identity.
    expect(ACTION_OK).toBe(ACTION_OK);
    expect(ACTION_OK).toEqual({ ok: true });
  });

  it("does at least give each failure its own object", () => {
    expect(actionError("wrongPassword")).not.toBe(actionError("wrongPassword"));
  });
});

describe("advanceSubmitCount", () => {
  it("counts nothing until something finishes", () => {
    const started = advanceSubmitCount(idle(), true);

    expect(started.wasPending).toBe(true);
    expect(started.count).toBe(0);
  });

  it("counts on the falling edge", () => {
    expect(submit(idle()).count).toBe(1);
  });

  it("counts every submission, not just the first", () => {
    let state = idle();
    for (const expected of [1, 2, 3, 4, 5]) {
      state = submit(state);
      expect(state.count).toBe(expected);
    }
  });

  it("ignores a render where pending did not move", () => {
    const state = advanceSubmitCount(idle(), true);

    // Same object back, so React bails out of the render-phase update instead
    // of looping.
    expect(advanceSubmitCount(state, true)).toBe(state);
    expect(advanceSubmitCount(idle(), false)).toEqual(idle());
  });

  it("settles after one adjustment", () => {
    // The render-time pattern is only safe if the condition it guards goes false
    // immediately; a second pass with the same input must be a no-op.
    const once = advanceSubmitCount(idle(), true);
    expect(advanceSubmitCount(once, true)).toBe(once);
  });
});

describe("the toast's reset rule, over the reported sequence", () => {
  /** What `Toast` compares each render to decide it is looking at a new one. */
  type Shown = { message: string | null; nonce: number };
  const isNew = (shown: Shown, message: string | null, nonce: number) =>
    message !== shown.message || nonce !== shown.nonce;

  const SAVED = "Bilgilerin kaydedildi.";

  it("re-shows an identical message on the second save", () => {
    let counter = idle();
    let shown: Shown = { message: null, nonce: 0 };

    // First save: the message arrives, the toast appears, five seconds pass and
    // it dismisses itself.
    counter = submit(counter);
    expect(isNew(shown, SAVED, counter.count)).toBe(true);
    shown = { message: SAVED, nonce: counter.count };

    // Second save: same object, same sentence — and the toast must still show.
    counter = submit(counter);
    expect(isNew(shown, SAVED, counter.count)).toBe(true);
  });

  it("would have stayed silent on the message alone", () => {
    // The old rule, kept here as the thing that must not come back.
    const byMessageOnly = (previous: string | null, message: string | null) =>
      message !== previous;

    expect(byMessageOnly(null, SAVED)).toBe(true);
    expect(byMessageOnly(SAVED, SAVED)).toBe(false);
  });

  it("re-shows a repeated identical error too", () => {
    // Typing the wrong current password twice is the same shape of problem.
    const WRONG = "Mevcut şifren hatalı.";
    let counter = submit(idle());
    let shown: Shown = { message: WRONG, nonce: counter.count };

    counter = submit(counter);
    expect(isNew(shown, WRONG, counter.count)).toBe(true);
    shown = { message: WRONG, nonce: counter.count };

    // And a re-render with nothing new changes nothing.
    expect(isNew(shown, WRONG, counter.count)).toBe(false);
  });

  it("still reacts when the message changes without a new submission", () => {
    // Belt and braces: the nonce is an addition to the old rule, not a
    // replacement for it.
    const shown: Shown = { message: "bir şey", nonce: 3 };
    expect(isNew(shown, "başka bir şey", 3)).toBe(true);
  });
});
