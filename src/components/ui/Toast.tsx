"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { TONES, type AlertTone } from "@/components/ui/Alert";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

/** Long enough to read a sentence, short enough not to sit in the way. */
export const TOAST_DURATION_MS = 5000;

export interface ToastProps {
  /** Shown while non-null. */
  message: string | null;
  /**
   * Which occurrence this is. A change re-shows the toast even when the words
   * are identical.
   *
   * Needed because the message alone is not an identity: `ACTION_OK` is one
   * shared object, so a second successful save produces the very same string as
   * the first, and without this the toast would treat it as the one it already
   * dismissed. Pass `useSubmitCount(pending)`.
   */
  nonce?: string | number;
  tone?: AlertTone;
  icon?: IconName;
  /** Milliseconds before it dismisses itself; `0` keeps it until closed. */
  duration?: number;
  /** Accessible name for the close button — `dict.common.close`. */
  closeLabel: string;
  className?: string;
}

/**
 * A message that arrives in the top-right corner and leaves on its own.
 *
 * Deliberately *not* what `Alert` became. `Alert` is the inline block `Field`
 * puts under a control to say what is wrong with it, and a validation message
 * that flew to the corner of the screen would be describing a control the reader
 * can no longer see it next to. So the two are separate: `Alert` for "fix this,
 * here", `Toast` for "that thing you did, here is how it went".
 *
 * The tints, icons and announcement roles come from `Alert`'s own tables, so a
 * success is the same green and the same `role="status"` whichever shape it
 * takes. Only the size and the position differ.
 *
 * Three things make a self-dismissing message safe to use:
 *
 *  - **It pauses while pointed at or focused.** A five-second timer is a guess
 *    about reading speed, and it is wrong for somebody.
 *  - **It can be closed.** Content on a timer needs a way out that does not
 *    involve waiting.
 *  - **It never carries the only copy of anything.** Field-level errors stay on
 *    their fields; this reports the outcome of an action, which the screen behind
 *    it already reflects.
 */
export function Toast({
  message,
  nonce,
  tone = "danger",
  icon,
  duration = TOAST_DURATION_MS,
  closeLabel,
  className,
}: ToastProps) {
  const [dismissed, setDismissed] = useState(false);
  const [paused, setPaused] = useState(false);

  /**
   * Whether the browser has taken over, so `document` exists to portal into.
   *
   * `useSyncExternalStore` rather than a `useState` + `useEffect` pair: it gives
   * a different answer on the server and the client by design, which is exactly
   * the question being asked, and it does not set state from an effect.
   */
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  /**
   * A new occurrence is a new toast: it comes back even if the last was closed.
   *
   * Keyed on the message *and* the nonce, because the message on its own cannot
   * tell "said again" from "still showing" — two successful saves carry the same
   * sentence, and comparing only that is what made the second one silent.
   *
   * Adjusted during render rather than in an effect. That is what React
   * recommends for resetting state when an input changes: an effect would render
   * the stale toast once before correcting it, and would trip
   * `react-hooks/set-state-in-effect` for saying so.
   */
  const [shown, setShown] = useState({ message, nonce });
  if (message !== shown.message || nonce !== shown.nonce) {
    setShown({ message, nonce });
    setDismissed(false);
    setPaused(false);
  }

  useEffect(() => {
    if (message === null || dismissed || paused || duration === 0) return;

    const timer = setTimeout(() => setDismissed(true), duration);
    return () => clearTimeout(timer);
    // `nonce` is a dependency so a repeat of the same message restarts the
    // countdown rather than riding out the one already running.
    // Pausing clears the timer and resuming starts a fresh one, so moving the
    // pointer away hands back the whole five seconds rather than the sliver that
    // was left. Someone who paused to read it wanted the time.
  }, [message, nonce, dismissed, paused, duration]);

  if (!hydrated || message === null || dismissed) return null;

  const { box, icon: defaultIcon, role, live } = TONES[tone];

  const toast = (
    <div
      role={role}
      aria-live={live}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className={cn(
        // Above everything, the navigation drawer (z-[99]) included: a toast that
        // loses to the thing it is reporting on is not reporting anything.
        "fixed z-[100] flex items-center gap-3 rounded-lg border-2 shadow-lg",
        "px-4 py-3.5 text-md font-bold",
        // Full width on a phone, clear of the 56px sticky header. From `sm` it
        // hugs the right edge at a fixed width, and from `lg` the header is gone
        // so it can sit at the very top.
        "top-17 right-4 left-4",
        "sm:left-auto sm:w-92",
        "lg:top-4",
        "motion-safe:animate-[toast-in_180ms_ease-out]",
        box,
        className,
      )}
    >
      <Icon name={icon ?? defaultIcon} className="mt-0.5 h-5 w-5" />
      <span className="min-w-0 flex-1">{message}</span>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={closeLabel}
        // 32px rather than 44: it sits inside the toast's own padding and is a
        // convenience, not the way out — the toast leaves by itself regardless.
        className="-mr-1 -mt-0.5 flex size-8 flex-none items-center justify-center rounded-md hover:bg-black/5"
      >
        <Icon name="close" className="h-4 w-4" />
      </button>
    </div>
  );

  /*
   * Portalled to `document.body` rather than left where it is written.
   *
   * `position: fixed` is only relative to the viewport while no ancestor has a
   * transform, a filter or `contain` — any one of those silently turns it into
   * "fixed inside that element", and the toast ends up clipped, behind
   * something, or off screen. It is rendered inside forms that sit deep in a
   * layout it does not control, so rather than depend on that layout staying
   * transform-free forever, it leaves the tree entirely. React keeps it in the
   * same component lifecycle either way.
   */
  return createPortal(toast, document.body);
}
