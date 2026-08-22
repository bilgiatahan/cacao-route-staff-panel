import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

export type Accent = "blue" | "green" | "amber" | "violet" | "rose";

/** Wash + ink for each accent, used by icon tiles and initials chips. */
export const ACCENT_CHIP: Record<Accent, string> = {
  blue: "bg-accent-blue-soft text-accent-blue",
  green: "bg-accent-green-soft text-accent-green",
  amber: "bg-accent-amber-soft text-accent-amber",
  violet: "bg-accent-violet-soft text-accent-violet",
  rose: "bg-accent-rose-soft text-accent-rose",
};

/** The 3px edge that opens a roster row. */
export const ACCENT_EDGE: Record<Accent, string> = {
  blue: "border-l-accent-blue",
  green: "border-l-accent-green",
  amber: "border-l-accent-amber",
  violet: "border-l-accent-violet",
  rose: "border-l-accent-rose",
};

const ACCENT_CYCLE: Accent[] = ["green", "amber", "blue", "violet", "rose"];

/**
 * Colour is a way to tell rows apart at a glance, so it has to be stable: the
 * same person keeps the same accent across renders and across pages.
 */
export function accentForId(id: string): Accent {
  let sum = 0;
  for (let index = 0; index < id.length; index += 1) sum += id.charCodeAt(index);
  return ACCENT_CYCLE[sum % ACCENT_CYCLE.length];
}

/** The one card surface: hairline border, `lg` radius, white ground. */
const SURFACE = "rounded-lg border border-line bg-surface";

/**
 * Padding is opt-in because every existing caller already supplies its own, and
 * changing that silently would reflow eight screens. New code should prefer
 * `padding="md"` over hand-rolled `px-*`/`py-*`.
 */
const PADDING = {
  none: "",
  sm: "p-3",
  md: "p-3.5",
} as const;

export type CardPadding = keyof typeof PADDING;

export interface CardProps {
  children: ReactNode;
  /** Renders the card as a link, with the hover state that implies. */
  href?: string;
  /** Defaults to `none` so existing callers keep the padding they pass. */
  padding?: CardPadding;
  /** Lifts the card off the ground — for sheets and things that overlap. */
  elevated?: boolean;
  className?: string;
}

/** The summary's base surface: white, hairline border, soft corners. */
export function Card({
  children,
  href,
  padding = "none",
  elevated = false,
  className,
}: CardProps) {
  const surface = cn(SURFACE, PADDING[padding], elevated && "shadow-sm");

  // `className` goes last in both branches: `cn` is tailwind-merge, so the final
  // class in a group wins. With the defaults after it, a caller passing `flex`
  // lost to this `block` and a caller tinting the surface lost to `bg-surface`.
  if (href) {
    return (
      <Link href={href} className={cn(surface, "block hover:border-line-strong", className)}>
        {children}
      </Link>
    );
  }

  return <div className={cn(surface, className)}>{children}</div>;
}

export interface IconTileProps {
  name: IconName;
  accent: Accent;
  className?: string;
}

/** Rounded tint square holding one glyph — the marker at the top of a card. */
export function IconTile({ name, accent, className }: IconTileProps) {
  return (
    <span
      className={cn(
        "flex size-8 flex-none items-center justify-center rounded-md",
        ACCENT_CHIP[accent],
        className,
      )}
    >
      <Icon name={name} className="h-[17px] w-[17px]" />
    </span>
  );
}

export interface StatCardProps {
  icon: IconName;
  accent: Accent;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Tints the whole card — used when a number needs attention. */
  highlight?: boolean;
}

/**
 * Icon, eyebrow, number, footnote — the metric tile of the summary grid.
 *
 * `highlight` used to be a warm tint and nothing else, so "this number needs
 * you" was carried by colour alone. The footnote becomes a `Badge` instead: a
 * chip is a different shape, not just a different hue.
 */
export function StatCard({ icon, accent, label, value, hint, highlight }: StatCardProps) {
  return (
    <Card padding="sm" className={cn(highlight && "border-warn bg-warn-soft")}>
      <IconTile name={icon} accent={accent} />
      <div className="label-eyebrow mt-2.5 truncate">{label}</div>
      <div className="tabular mt-0.5 text-3xl font-extrabold -tracking-[0.02em]">{value}</div>
      {hint ? (
        highlight ? (
          <Badge tone="warning" className="mt-1.5 max-w-full truncate">
            {hint}
          </Badge>
        ) : (
          <div className="mt-0.5 truncate text-xs text-muted">{hint}</div>
        )
      ) : null}
    </Card>
  );
}
