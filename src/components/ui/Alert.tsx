import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

export type AlertTone = "danger" | "warning" | "success" | "info";

/**
 * Card-family message block: tinted ground, hairline border, soft corners.
 *
 * Every tone pairs an ink with its own wash at 4.5:1 or better, so the text is
 * readable without relying on the icon or the colour alone.
 */
const TONES: Record<AlertTone, { box: string; icon: IconName }> = {
  danger: { box: "border-danger/25 bg-danger-soft text-danger", icon: "alert" },
  warning: { box: "border-warn/40 bg-warn-soft text-warn-dark", icon: "alert" },
  success: { box: "border-success/25 bg-success-soft text-success", icon: "calendarCheck" },
  info: { box: "border-brand/20 bg-brand-faint text-brand-dark", icon: "info" },
};

/**
 * `danger` and `warning` interrupt — a failed action is news the user did not
 * ask for. `success` and `info` are polite, so they never talk over whatever the
 * screen reader is already saying.
 */
const LIVE: Record<AlertTone, { role: "alert" | "status"; live: "assertive" | "polite" }> = {
  danger: { role: "alert", live: "assertive" },
  warning: { role: "alert", live: "assertive" },
  success: { role: "status", live: "polite" },
  info: { role: "status", live: "polite" },
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

export function Alert({ children, tone = "danger", icon, id, className }: AlertProps) {
  const { box, icon: defaultIcon } = TONES[tone];
  const { role, live } = LIVE[tone];

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
