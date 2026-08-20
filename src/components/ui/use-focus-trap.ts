"use client";

import { useEffect, type RefObject } from "react";

/**
 * What counts as reachable by Tab inside an overlay.
 *
 * `[tabindex="-1"]` is excluded deliberately: those elements can be focused
 * programmatically but are not part of the tab order, so wrapping onto one would
 * strand the user.
 */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Keeps Tab and Shift+Tab inside an open overlay.
 *
 * Both `Sheet` and `AppMenu` announce themselves with `aria-modal`, and both
 * already close on Escape and restore focus — but Tab walked straight out into
 * the page they claimed was unavailable. This wraps the tab order instead.
 *
 * It only handles wrapping. Initial focus and restoration stay with the caller,
 * which is where they already worked correctly.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;

      // Re-read on every keypress: a sheet's controls appear and disappear as
      // its form changes, so a list captured on open would go stale.
      const reachable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((element) => element.offsetParent !== null);

      if (reachable.length === 0) {
        // Nothing to move to, but focus still must not leave.
        event.preventDefault();
        return;
      }

      const first = reachable[0];
      const last = reachable[reachable.length - 1];
      const current = document.activeElement;
      const inside = current instanceof Node && container.contains(current);

      if (event.shiftKey) {
        if (!inside || current === first) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (!inside || current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Capture phase, so the wrap happens before anything else reads the key.
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [containerRef, active]);
}
