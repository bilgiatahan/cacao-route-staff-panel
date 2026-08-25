import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

export type AlertTone = "danger" | "warning" | "success" | "info";

export interface AlertToneStyle {
  /** Border, ground and ink. */
  box: string;
  icon: IconName;
  /**
   * `danger` and `warning` interrupt — a failed action is news the user did not
   * ask for. `success` and `info` are polite, so they never talk over whatever
   * the screen reader is already saying.
   */
  role: "alert" | "status";
  live: "assertive" | "polite";
}

/**
 * Card-family message treatment: tinted ground, hairline border, soft corners.
 *
 * Every tone pairs an ink with its own wash at 4.5:1 or better, so the text is
 * readable without relying on the icon or the colour alone.
 *
 * Exported because `Toast` is the same message in a different shape — a corner
 * popup rather than an inline block — and a success that were a different green
 * or announced differently depending on where it appeared would be two designs
 * wearing one name.
 */
export const TONES: Record<AlertTone, AlertToneStyle> = {
  danger: {
    box: "border-danger/25 bg-danger-soft text-danger",
    icon: "alert",
    role: "alert",
    live: "assertive",
  },
  warning: {
    box: "border-warn/40 bg-warn-soft text-warn-dark",
    icon: "alert",
    role: "alert",
    live: "assertive",
  },
  success: {
    box: "border-success/25 bg-success-soft text-success",
    icon: "calendarCheck",
    role: "status",
    live: "polite",
  },
  info: {
    box: "border-brand/20 bg-brand-faint text-brand-dark",
    icon: "info",
    role: "status",
    live: "polite",
  },
};

export interface AlertProps {
  children: ReactNode;
  tone?: AlertTone;
  /** Overrides the tone's default glyph. */
  icon?: IconName;
  /** Set when the alert describes one control, so it can be pointed at. */
  id?: string;
  className?: string;
}

/**
 * The inline message block: sits in the flow, next to what it is about.
 *
 * `Field` renders one under a control to say what is wrong with it, so this
 * deliberately does not float, dismiss itself or move — a validation message
 * that left for the corner of the screen would be describing a control the
 * reader can no longer see it beside. Feedback about a completed action goes in
 * a `Toast` instead.
 */
export function Alert({ children, tone = "danger", icon, id, className }: AlertProps) {
  const { box, icon: defaultIcon, role, live } = TONES[tone];

  return (
    <div
      id={id}
      role={role}
      aria-live={live}
      className={cn(
        "flex items-start gap-2 rounded-md border px-2.5 py-2 text-sm font-semibold",
        box,
        className,
      )}
    >
      <Icon name={icon ?? defaultIcon} className="mt-px h-4 w-4" />
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}
