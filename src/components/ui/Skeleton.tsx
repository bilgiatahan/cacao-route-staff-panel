import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Placeholder shapes for a route that is still fetching.
 *
 * The pulse is decoration, never the message: `SkeletonScreen` marks itself
 * `aria-busy` and carries a visually-hidden label, so the state is announced
 * even with animation disabled. `motion-reduce:animate-none` honours the OS
 * setting rather than assuming everyone wants movement.
 */
const BASE = "bg-fill-strong motion-safe:animate-pulse motion-reduce:animate-none";

export function SkeletonLine({ className }: { className?: string }) {
  return <div aria-hidden className={cn(BASE, "h-3 rounded-sm", className)} />;
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden className={cn(BASE, "rounded-lg", className)} />;
}

/** A card-shaped placeholder: the shape most panel screens are made of. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-line bg-surface p-3.5", className)}>
      <SkeletonLine className="w-1/3" />
      <SkeletonLine className="mt-2.5 h-5 w-2/3" />
      <SkeletonLine className="mt-2 w-1/2" />
    </div>
  );
}

export interface SkeletonScreenProps {
  /** Announced to assistive tech; the visual pulse is not the only signal. */
  label: string;
  children: ReactNode;
  className?: string;
}

export function SkeletonScreen({ label, children, className }: SkeletonScreenProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn("flex flex-1 flex-col gap-3.5 px-4 pb-6 pt-3.5", className)}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
