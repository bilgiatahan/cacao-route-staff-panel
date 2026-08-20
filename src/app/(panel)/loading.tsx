import { SkeletonCard, SkeletonLine, SkeletonScreen } from "@/components/ui/Skeleton";
import { getTranslations } from "@/lib/i18n/server";

/**
 * Shown while a panel tab's server render is in flight.
 *
 * Every screen here is dynamic and queries Postgres, so before this existed a
 * tab tap produced no feedback at all until the payload arrived. The shape is
 * deliberately generic — a heading, a pair of tiles, a list — because it stands
 * in for five different screens; a per-route skeleton belongs with each screen's
 * own migration, not here.
 */
export default async function PanelLoading() {
  const { dict } = await getTranslations();

  return (
    <SkeletonScreen label={dict.common.loading}>
      <SkeletonLine className="h-6 w-2/5" />
      <div className="grid grid-cols-2 gap-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="rounded-lg border border-line bg-surface">
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className={row > 0 ? "border-t border-line px-3.5 py-3" : "px-3.5 py-3"}
          >
            <SkeletonLine className="w-1/3" />
            <SkeletonLine className="mt-2 w-3/5" />
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}
