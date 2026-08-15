import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  /** `plain` drops the gutter for card views that already pad themselves. */
  variant?: "rule" | "plain";
}

/** The large heading that opens every tab. */
export function PageHeader({
  title,
  subtitle,
  action,
  variant = "rule",
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-end justify-between gap-2.5",
        variant === "plain" ? "pb-1 pt-3" : "px-4 pb-3 pt-4",
      )}
    >
      <div className="min-w-0 flex justify-between items-center w-full">
        <h1 className="text-3xl font-bold">{title}</h1>
        {subtitle && (
          <div className="mt-0.5 text-sm text-muted">{subtitle}</div>
        )}
      </div>
      {action ? <div className="flex-none">{action}</div> : null}
    </div>
  );
}

export interface SectionHeadingProps {
  title: string;
  meta?: ReactNode;
  /**
   * `rule` is the all-caps label sitting on the 2px ink divider the ruled views
   * use; `plain` is the sentence-case heading the card views use, where the
   * card border already does the dividing; `card` is the compact brand-coloured
   * label that names a single card below it.
   */
  variant?: "rule" | "plain" | "card";
  /** Only drawn by the `card` variant — the glyph that opens the label. */
  icon?: IconName;
  className?: string;
}

const HEADING_LAYOUT: Record<
  NonNullable<SectionHeadingProps["variant"]>,
  string
> = {
  rule: "px-4 pb-2 pt-4.5",
  plain: "pb-0.5 pt-1.5",
  card: "pb-1 pt-1.5",
};

const HEADING_TITLE: Record<
  NonNullable<SectionHeadingProps["variant"]>,
  string
> = {
  rule: "label-section",
  plain: "text-2xl font-bold",
  card: "text-sm font-bold uppercase tracking-[0.08em]",
};

export function SectionHeading({
  title,
  meta,
  variant = "rule",
  icon,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex justify-between gap-2 mb-2",
        // The card variant centres on its glyph; the others sit on a baseline.
        variant === "card" ? "items-center" : "items-baseline",
        HEADING_LAYOUT[variant],
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {icon && (
          <span
            className={cn(
              "flex size-8 flex-none items-center justify-center rounded-md bg-accent-green-soft text-accent-green",
            )}
          >
            <Icon name={icon} className="h-4.25 w-4.25" />
          </span>
        )}
        <h2 className={cn("truncate", HEADING_TITLE[variant])}>{title}</h2>
      </div>
      {meta && (
        <div className="flex-none text-xs font-semibold text-muted">{meta}</div>
      )}
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
  return (
    <div className={cn("border-t-2 border-ink", className)}>{children}</div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-4 py-4.5 text-sm text-muted-soft">{children}</p>;
}
