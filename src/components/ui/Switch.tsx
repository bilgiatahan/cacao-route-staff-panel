import { cn } from "@/lib/utils";

export interface SwitchProps {
  /** Posted with the form; the field is absent when the switch is off. */
  name: string;
  /** The control's accessible name, and the line the reader scans. */
  label: string;
  /** What the setting does, under the label. */
  description?: string;
  /** The two positions, spelled out — the track's colour is never the only cue. */
  stateLabels: { on: string; off: string };
  defaultChecked?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * A single on/off setting, as a switch rather than a checkbox.
 *
 * Two things about it that look like mistakes and are not:
 *
 *  - **It is square.** The radius ladder in `globals.css` reserves `full` for
 *    avatars and count badges, and the button primitive is emphatic that nothing
 *    else in this panel is a pill. So the track sits on `md` and the knob on
 *    `sm`, the same two steps every input and chip uses. It reads as a switch
 *    from the movement and the fill, not from being lozenge-shaped.
 *  - **It is a real `<input type="checkbox">`,** visually hidden behind the
 *    track. That is what buys the keyboard behaviour, the checked state in the
 *    accessibility tree, and the form serialisation for free — a `<div
 *    role="switch">` would need all three re-implemented in a client component,
 *    and this one renders on the server.
 *
 * The current position is also written out as text (`stateLabels`), because a
 * fill colour is not a state anyone can read aloud. Those words are `aria-hidden`
 * — the checkbox already announces itself as checked or unchecked, and letting
 * them into the accessible name would say it twice.
 */
export function Switch({
  name,
  label,
  description,
  stateLabels,
  defaultChecked = false,
  disabled = false,
  className,
}: SwitchProps) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3",
        disabled && "cursor-not-allowed",
        className,
      )}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="peer sr-only"
      />

      <span
        aria-hidden
        className={cn(
          "relative h-7 w-12 flex-none rounded-md border border-line-strong bg-fill-strong",
          "transition-colors",
          // The knob is a child, so its travel is written from the track, which
          // is the element the `peer` variants can actually reach.
          "peer-checked:border-brand peer-checked:bg-brand",
          "peer-checked:[&>span]:translate-x-5",
          // The input is `sr-only`, so the global `:focus-visible` ring has
          // nothing visible to draw around; the track wears it instead.
          "peer-focus-visible:outline peer-focus-visible:outline-2",
          "peer-focus-visible:outline-brand peer-focus-visible:outline-offset-2",
          "peer-disabled:border-line peer-disabled:bg-fill",
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-6 w-6 rounded-sm bg-surface shadow-sm",
            "motion-safe:transition-transform motion-safe:duration-150",
          )}
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-ink">{label}</span>
        {description ? (
          <span className="block pt-0.5 text-xs text-muted">{description}</span>
        ) : null}
      </span>

      {/* The position in words. Swapped by the same `:checked` state that moves
          the knob, so there is no client JavaScript keeping them in step. */}
      <span
        aria-hidden
        className="block flex-none text-2xs font-bold uppercase tracking-[0.08em] text-muted peer-checked:hidden"
      >
        {stateLabels.off}
      </span>
      <span
        aria-hidden
        className="hidden flex-none text-2xs font-bold uppercase tracking-[0.08em] text-brand peer-checked:block"
      >
        {stateLabels.on}
      </span>
    </label>
  );
}
