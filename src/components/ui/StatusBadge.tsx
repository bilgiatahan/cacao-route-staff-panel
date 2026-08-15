import { cn } from "@/lib/utils";
import type { RequestStatus } from "@/types/domain";

const STATUS_STYLES: Record<RequestStatus, string> = {
  pending: "bg-warn text-ink",
  approved: "bg-brand-soft text-brand-dark",
  rejected: "bg-fill-strong text-muted",
};

export interface StatusBadgeProps {
  status: RequestStatus;
  label: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "flex-none px-[7px] py-1 text-2xs font-extrabold tracking-[0.08em]",
        STATUS_STYLES[status],
        className,
      )}
    >
      {label}
    </span>
  );
}
