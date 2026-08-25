import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { Alert } from "@/components/ui/Alert";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

/**
 * Every native control in the ruled views shares this frame.
 *
 * `text-control` is 16px and is not negotiable per control: iOS Safari zooms the
 * viewport when a focused input is smaller than that, and never zooms back out.
 */
export const CONTROL_CLASS =
  "w-full border border-line-strong bg-surface px-2.5 py-2.5 text-control text-ink " +
  "placeholder:text-muted" +
  "disabled:cursor-not-allowed disabled:border-line disabled:bg-fill disabled:text-disabled " +
  "read-only:bg-fill read-only:text-muted " +
  // `invalid` is driven by `aria-invalid`, so the styling and the announcement
  // can never disagree.
  "aria-invalid:border-danger aria-invalid:bg-danger-soft";

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-2xs font-bold uppercase tracking-[0.08em] text-muted">{children}</span>
  );
}

export interface FieldProps {
  label: string;
  children: ReactNode;
  /**
   * Rendered below the control as a `FormError`. Deliberately outside the
   * `<label>`: inside, it would join the control's accessible *name* instead of
   * describing it.
   */
  error?: ReactNode;
  /** Point the control's `aria-describedby` at this to complete the wiring. */
  errorId?: string;
  /** Guidance under the control. Replaced by `error` while one is showing. */
  hint?: ReactNode;
  /**
   * Draws the marker. The announcement comes from the control's own `required`
   * attribute, which every caller already sets — the asterisk is the visual half
   * of that, never the whole story.
   */
  required?: boolean;
  className?: string;
}

export function Field({
  label,
  children,
  error,
  errorId,
  hint,
  required = false,
  className,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="flex flex-col gap-1">
        <FieldLabel>
          {label}
          {required ? (
            <span aria-hidden className="pl-0.5 text-danger">
              *
            </span>
          ) : null}
        </FieldLabel>
        {children}
      </label>
      {error ? (
        <FormError id={errorId}>{error}</FormError>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL_CLASS, className)} {...props} />;
}

export function NumberInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input type="number" min={0} className={cn(CONTROL_CLASS, "tabular", className)} {...props} />
  );
}

export function DateInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input type="date" className={cn(CONTROL_CLASS, "tabular", className)} {...props} />
  );
}

export function TimeInput({
  className,
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return (
    <input
      ref={ref}
      type="time"
      step={900}
      className={cn(CONTROL_CLASS, "tabular px-2.5 py-3", className)}
      {...props}
    />
  );
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL_CLASS, "resize-y", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(CONTROL_CLASS, className)} {...props} />;
}

/**
 * The card family's counterpart to `CONTROL_CLASS`: soft corners and a hairline
 * border, so a form can sit on a `Card` without fighting the surface it is on.
 */
export const CONTROL_CLASS_SOFT =
  "w-full rounded-md border border-line bg-surface px-3 py-2.5 text-control text-ink " +
  // No `focus:outline-none` here. It compiles to `.focus\:outline-none:focus`,
  // which outranks the global `:focus-visible` rule on specificity and left
  // keyboard users with nothing but a 1px border colour change.
  "placeholder:text-muted hover:border-line-strong focus:border-brand " +
  "disabled:cursor-not-allowed disabled:bg-fill disabled:text-disabled " +
  "read-only:bg-fill read-only:text-muted " +
  "aria-invalid:border-danger aria-invalid:bg-danger-soft";

export interface SoftInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Seated inside the left edge; the control makes room for it itself. */
  icon?: IconName;
  /** Needed by `PhoneInput`, which has to put the caret back after reformatting. */
  ref?: Ref<HTMLInputElement>;
}

export function SoftInput({ icon, className, ref, ...props }: SoftInputProps) {
  const control = (
    <input ref={ref} className={cn(CONTROL_CLASS_SOFT, icon && "pl-9", className)} {...props} />
  );
  if (!icon) return control;

  return (
    <span className="relative flex items-center">
      <Icon
        name={icon}
        className="pointer-events-none absolute left-3 h-4 w-4 text-muted"
      />
      {control}
    </span>
  );
}

export function SoftTextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL_CLASS_SOFT, "resize-y", className)} {...props} />;
}

/**
 * Kept as the name every form already imports; it is now an `Alert`, so the five
 * existing call sites pick up the Card-family treatment and the announcement
 * behaviour without changing.
 */
export function FormError({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <Alert tone="danger" id={id}>
      {children}
    </Alert>
  );
}
