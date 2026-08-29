import { Flag } from "@/components/ui/Flag";
import { LOCALES } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { setLocaleAction } from "@/server/actions/locale.actions";
import type { Locale } from "@/types/domain";

export interface LocalePickerLabels {
  /** Names the group — "Dil / Language". */
  group: string;
  /** Autonyms, for the accessible name behind each two-letter code. */
  names: Record<Locale, string>;
}

export interface LocalePickerProps {
  current: Locale;
  labels: LocalePickerLabels;
  className?: string;
}

/**
 * Language as a two-option switch rather than a toggle.
 *
 * The old control was one globe button that flipped to "the other" language,
 * which meant the surface never showed which one you were actually in — you had
 * to read the rest of the interface to find out. Two chips state the current
 * language and the alternative at the same time.
 *
 * One form, two submit buttons, each carrying its own `name="locale"` value. So
 * this is server-rendered markup with no client JavaScript and no `bind`: the
 * browser posts the button that was pressed, and `setLocaleAction` reads it.
 *
 * The flag never carries the meaning alone — every chip pairs it with the locale
 * code, and the selected one is marked by fill *and* `aria-pressed`, so the state
 * survives greyscale, a screen reader, and a flag that failed to paint.
 */
export function LocalePicker({ current, labels, className }: LocalePickerProps) {
  return (
    <form action={setLocaleAction}>
      <div
        role="group"
        aria-label={labels.group}
        className={cn(
          // Same track as `SegmentedControl`: hairline border, `md` radius.
          "flex gap-0.5 rounded-md border border-line bg-surface p-0.5",
          className,
        )}
      >
        {LOCALES.map((locale) => {
          const active = locale === current;

          return (
            <button
              key={locale}
              type="submit"
              name="locale"
              value={locale}
              aria-pressed={active}
              title={labels.names[locale]}
              className={cn(
                // 40px rather than 44: this sits inside a track that is itself
                // inside a 44px row, and it is a dense inline control, not the
                // page's primary touch target — the `sm` Button rule.
                "flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-sm px-2",
                "text-xs font-extrabold uppercase tracking-[0.08em] transition-colors",
                "focus-visible:outline-offset-[-3px]",
                active
                  ? "bg-brand text-white"
                  : "text-muted hover:bg-hover hover:text-ink",
              )}
            >
              <Flag
                locale={locale}
                // The unselected flags sit back so the chosen one reads first,
                // without either of them becoming unrecognisable.
                className={cn(!active && "opacity-70")}
              />
              <span className="hidden xl:inline">{locale}</span>
              {/* The code alone is not a language name. */}
              <span className="sr-only hidden xl:inline">{labels.names[locale]}</span>
            </button>
          );
        })}
      </div>
    </form>
  );
}
