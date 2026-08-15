import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

/** Every native control in the panel shares this frame. */
export const CONTROL_CLASS =
  "w-full border border-line-strong bg-surface px-2.5 py-2.5 text-md text-ink " +
  "placeholder:text-muted-soft disabled:bg-surface-alt disabled:text-muted";

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-2xs font-bold uppercase tracking-[0.08em] text-muted">{children}</span>
  );
}

export interface FieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, children, className }: FieldProps) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </label>
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
    <input type="date" className={cn(CONTROL_CLASS, "tabular text-base", className)} {...props} />
  );
}

export function TimeInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="time"
      step={900}
      className={cn(CONTROL_CLASS, "tabular px-2.5 py-3 text-lg", className)}
      {...props}
    />
  );
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL_CLASS, "resize-y text-base", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(CONTROL_CLASS, "text-base", className)} {...props} />;
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="bg-warn-soft px-2.5 py-2 text-xs font-semibold text-warn-dark">
      {children}
    </p>
  );
}
