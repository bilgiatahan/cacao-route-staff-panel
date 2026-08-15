import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border border-brand bg-brand text-white hover:bg-brand-dark",
  outline: "border border-line-strong bg-surface text-ink hover:bg-hover",
  ghost: "border border-transparent bg-transparent text-brand hover:text-brand-dark",
  danger: "border border-line-strong bg-surface text-danger hover:bg-hover",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-2.5 py-[7px] text-xs",
  md: "px-3 py-2.5 text-sm",
  lg: "px-3.5 py-3 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-bold tracking-[0.04em] transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
}
