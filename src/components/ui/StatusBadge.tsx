import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { RequestStatus } from "@/types/domain";

/**
 * A request's status in the shared badge vocabulary. `pending` reads as a
 * warning because it is the one state that needs someone to act.
 */
const STATUS_TONES: Record<RequestStatus, BadgeTone> = {
  pending: "warning",
  approved: "info",
  rejected: "neutral",
};

export interface StatusBadgeProps {
  status: RequestStatus;
  label: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <Badge tone={STATUS_TONES[status]} className={className}>
      {label}
    </Badge>
  );
}
