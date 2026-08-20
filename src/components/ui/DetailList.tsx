import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

export interface DetailItem {
  key: string;
  label: string;
  value: ReactNode;
  /** Optional marker; decorative, so it is muted rather than coloured. */
  icon?: IconName;
}

export interface DetailListProps {
  items: DetailItem[];
  className?: string;
}

/**
 * Read-only facts as a definition list: eyebrow label on the left, value on the
 * right, hairline between rows.
 *
 * This is the answer to "show a value the user cannot change" — the alternative,
 * a disabled input, looks like something that should be editable and merely
 * isn't. The absence of input chrome is what communicates read-only, so the
 * icons stay muted; a colour per row would be decoration that adds no meaning.
 */
export function DetailList({ items, className }: DetailListProps) {
  return (
    <dl className={className}>
      {items.map((item, index) => (
        <div
          key={item.key}
          className={cn(
            "flex items-center gap-2.5 py-2.5",
            index > 0 && "border-t border-line",
          )}
        >
          {item.icon ? (
            <Icon name={item.icon} className="h-4 w-4 flex-none text-muted" />
          ) : null}
          <dt className="label-eyebrow min-w-0 flex-1 truncate">{item.label}</dt>
          <dd className="tabular flex-none text-sm font-bold text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
