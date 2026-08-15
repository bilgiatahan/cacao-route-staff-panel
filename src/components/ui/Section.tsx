import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}

/** The large heading that opens every tab. */
export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-2.5 px-4 pb-3 pt-4">
      <div className="min-w-0">
        <h1 className="text-4xl font-bold">{title}</h1>
        {subtitle ? <div className="mt-0.5 text-sm text-muted">{subtitle}</div> : null}
      </div>
      {action ? <div className="flex-none">{action}</div> : null}
    </div>
  );
}

export interface SectionHeadingProps {
  title: string;
  meta?: ReactNode;
  className?: string;
}

/** Small all-caps heading that sits directly above a 2px ink rule. */
export function SectionHeading({ title, meta, className }: SectionHeadingProps) {
  return (
    <div className={cn("flex items-baseline justify-between gap-2 px-4 pb-2 pt-4.5", className)}>
      <h2 className="label-section">{title}</h2>
      {meta ? <div className="text-xs font-semibold text-muted">{meta}</div> : null}
    </div>
  );
}

/** Content block opened by the heavy ink rule the design uses as a divider. */
export function RuledList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("border-t-2 border-ink", className)}>{children}</div>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-4 py-4.5 text-sm text-muted-soft">{children}</p>;
}
