import { cn } from "@/lib/utils";
import type { Locale } from "@/types/domain";

/**
 * The two locale flags, as inline SVG.
 *
 * Deliberately not in `Icon`'s `ICONS` map, and this is the one case where that
 * is right: every glyph there is a single-colour `currentColor` stroke drawing at
 * 1.75px, and `Icon` restyles the whole set that way. A flag is a multi-colour
 * *fill*, so it cannot pass through that primitive without the primitive losing
 * the property that makes it useful. It gets its own component instead.
 *
 * Also deliberately not emoji. `🇹🇷` and `🇬🇧` are regional-indicator pairs, and
 * Windows renders them as the bare letters "TR" and "GB" rather than flags — so
 * on a large share of desktops an emoji picker would silently show text where a
 * flag belongs. SVG renders the same everywhere.
 *
 * Both flags share a 3:2 box so the two chips line up. That is correct for
 * Turkey and a compromise for the United Kingdom, whose flag is 2:1 — matching
 * boxes matter more in a 20px control than a ratio nobody can measure there.
 */

export interface FlagProps {
  locale: Locale;
  className?: string;
}

/**
 * Turkish flag, built to the proportions in the Turkish Flag Law: the crescent's
 * outer circle is a quarter of the height across and sits three-eighths of the
 * height from the hoist, with the inner circle offset to open it rightwards.
 */
function TurkishFlag() {
  return (
    <>
      <rect width="60" height="40" fill="#E30A17" />
      <circle cx="15" cy="20" r="10" fill="#fff" />
      {/* The crescent's opening: the field colour laid back over the disc. */}
      <circle cx="18" cy="20" r="8" fill="#E30A17" />
      <path
        fill="#fff"
        d="M29 14.25 30.35 18.14 34.47 18.22 31.19 20.71 32.38 24.65 29 22.3 25.62 24.65 26.81 20.71 23.53 18.22 27.65 18.14Z"
      />
    </>
  );
}

/**
 * Union Flag.
 *
 * The red saltire is drawn centred on the white one rather than counterchanged.
 * The real flag offsets it a fifth of the diagonal's width; at the 20px this
 * renders at, that offset is well under a pixel, and reproducing it costs a
 * `clipPath` whose `id` would then be duplicated on any page showing the picker
 * twice — which the rail and the drawer both do.
 */
function UnionFlag() {
  return (
    <>
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0 60 40M60 0 0 40" stroke="#fff" strokeWidth="8" />
      <path d="M0 0 60 40M60 0 0 40" stroke="#C8102E" strokeWidth="3.5" />
      <path d="M30 0V40M0 20H60" stroke="#fff" strokeWidth="13.3" />
      <path d="M30 0V40M0 20H60" stroke="#C8102E" strokeWidth="8" />
    </>
  );
}

/**
 * A flag chip. Purely decorative: every caller sits it beside the locale code
 * and an accessible name, so the drawing is never the only thing carrying the
 * meaning — the same rule the roster's empty cells follow.
 */
export function Flag({ locale, className }: FlagProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 60 40"
      // A hairline keeps a light flag's edge off a light card, and the radius
      // matches the `sm` step the chips around it use.
      className={cn(
        "h-3.5 w-5.25 flex-none rounded-[2px] ring-1 ring-inset ring-black/15",
        className,
      )}
    >
      {locale === "tr" ? <TurkishFlag /> : <UnionFlag />}
    </svg>
  );
}
