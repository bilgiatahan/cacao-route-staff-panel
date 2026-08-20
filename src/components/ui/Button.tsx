import type { ButtonHTMLAttributes, Ref } from "react";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Card-family button: soft corners on the `md` step of the radius ladder, never
 * a pill. Every variant carries its own border so swapping between them cannot
 * shift layout by a pixel.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-brand bg-brand text-white hover:bg-brand-dark active:bg-brand-dark",
  outline: "border-line-strong bg-surface text-ink hover:bg-hover active:bg-fill-strong",
  ghost: "border-transparent bg-transparent text-brand hover:bg-brand-faint",
  // Was indistinguishable from `outline` apart from the text colour, which gave
  // the most destructive control in the product the weakest affordance.
  danger: "border-danger/30 bg-danger-soft text-danger hover:bg-danger hover:text-white",
};

/**
 * `md` and `lg` clear the 44px touch minimum. `sm` is 40px and is for dense
 * inline controls only — not for anything a thumb has to find in a hurry.
 */
const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-10 px-3 text-sm",
  md: "min-h-11 px-3.5 text-base",
  lg: "min-h-12 px-4 text-md",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /**
   * Blocks interaction and shows a spinner. The label stays in place but is
   * hidden, so the button keeps its exact width and nothing reflows.
   */
  loading?: boolean;
  /** Announced while `loading`; the spinner alone says nothing to a screen reader. */
  loadingLabel?: string;
  /** Needed so a dialog can move focus onto its safe default control. */
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  loadingLabel,
  className,
  type = "button",
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      // A loading button must not be pressable twice.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "relative inline-flex items-center justify-center gap-1.5 rounded-md border",
        "font-bold tracking-[0.04em] transition-colors",
        "disabled:cursor-not-allowed disabled:border-line disabled:bg-fill disabled:text-disabled",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          {/* Kept in the box so the width does not change, hidden from both
              the screen and the accessibility tree. */}
          <span aria-hidden className="invisible inline-flex items-center gap-1.5">
            {children}
          </span>
          <span className="absolute inset-0 flex items-center justify-center">
            <Icon
              name="spinner"
              className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
            />
            {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
