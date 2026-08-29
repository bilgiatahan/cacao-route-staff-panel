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
        "flex items-center justify-between gap-2.5",
        variant === "plain" ? "pb-1 pt-3" : "px-4 pb-3 pt-4",
      )}
    >
      <div className="min-w-0 flex justify-between items-center w-full lg:w-auto lg:flex-col lg:items-start lg:justify-start">
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
            <Icon name={icon} className="h-4 w-4" />
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
    <div className={cn("border-t-2 border-line", className)}>{children}</div>
  );
}

export interface SectionBlockProps {
  title: string;
  /** Short right-aligned detail — a date, a count. */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * A heading and the block it introduces, kept together as one rhythm unit.
 *
 * This is the outside-a-card counterpart to `SectionHeading variant="card"`:
 * used when the section contains several cards rather than living inside one.
 */
export function SectionBlock({ title, meta, children, className }: SectionBlockProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <SectionHeading variant="plain" title={title} meta={meta} />
      {children}
    </div>
  );
}

export interface HintProps {
  children: ReactNode;
  /** Small leading glyph, for a hint that explains a whole block. */
  icon?: IconName;
  className?: string;
}

/**
 * Guidance attached to a group of controls or a card.
 *
 * `Field` has its own `hint` for a single control; this is the one that explains
 * a section — "leave both blank to keep your password", "your manager sets
 * these". It existed as a bare `<p className="text-xs text-muted">` in four
 * places, each spelled slightly differently.
 */
export function Hint({ children, icon, className }: HintProps) {
  return (
    <p className={cn("flex items-start gap-1.5 text-xs text-muted", className)}>
      {icon ? <Icon name={icon} className="mt-px h-4 w-4 flex-none" /> : null}
      <span>{children}</span>
    </p>
  );
}

export interface EmptyStateProps {
  children: ReactNode;
  /** A glyph makes an empty list read as a state rather than a failure. */
  icon?: IconName;
  /** Somewhere to go next: an empty screen should be an invitation to act. */
  action?: ReactNode;
  className?: string;
}

/**
 * The one empty state. Three near-identical copies of this markup previously
 * lived inline in the notification list, the roster's day view and the summary's
 * on-shift list.
 */
export function EmptyState({ children, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-start gap-2.5 px-4 py-4.5", className)}>
      <div className="flex items-center gap-2 text-muted">
        {icon ? (
          <span className="flex size-7 flex-none items-center justify-center rounded-md bg-fill-strong">
            <Icon name={icon} className="h-4 w-4" />
          </span>
        ) : null}
        <p className="text-sm">{children}</p>
      </div>
      {action}
    </div>
  );
}
