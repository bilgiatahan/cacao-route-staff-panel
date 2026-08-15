import { ACCENT_CHIP, type Accent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export type AvatarTone = "brand" | "warn" | "muted" | Accent;
export type AvatarSize = "sm" | "md" | "lg";

const TONES: Record<AvatarTone, string> = {
  brand: "bg-brand-soft text-brand-dark",
  warn: "bg-warn-soft text-warn-dark",
  muted: "bg-fill-strong text-muted",
  ...ACCENT_CHIP,
};

const SIZES: Record<AvatarSize, string> = {
  sm: "size-7 text-xs",
  md: "size-[34px] text-sm",
  lg: "size-[46px] text-2xl",
};

export interface AvatarProps {
  initials: string;
  tone?: AvatarTone;
  size?: AvatarSize;
  /** Solid brand fill, used for the signed-in user and the detail header. */
  solid?: boolean;
  className?: string;
}

export function Avatar({
  initials,
  tone = "brand",
  size = "md",
  solid = false,
  className,
}: AvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex flex-none items-center justify-center font-extrabold",
        solid ? "bg-brand text-white" : TONES[tone],
        SIZES[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}
