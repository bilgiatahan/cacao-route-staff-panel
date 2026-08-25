"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { Avatar } from "@/components/ui/Avatar";
import { CountBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { isNavItemActive, navHref } from "@/lib/nav";
import { LocalePicker, type LocalePickerLabels } from "./LocalePicker";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/server/actions/auth.actions";

import type { Locale } from "@/types/domain";

import type { NavItem } from "./BottomNav";

export interface SideNavProps {
  /** The same four destinations `BottomNav` receives, from the same array. */
  items: NavItem[];
  /** Notifications and Profile — the header bell and the drawer's one row. */
  secondary: NavItem[];
  brand: { name: string; panel: string };
  profile: { name: string; role: string; email: string; initials: string };
  labels: { navigation: string; language: string; signOut: string; version: string };
  /** Which language is showing, and what to call each one. */
  locale: { current: Locale; labels: LocalePickerLabels };
  appVersion: string;
}

/**
 * The desktop navigation surface, and the only one from `lg` up.
 *
 * It introduces no data of its own: the primary items are the array the layout
 * already built for `BottomNav`, the notification count is the one the header
 * bell already had, and the account block is what the drawer already showed. So
 * the sidebar is a second *arrangement* of the existing shell, not a second
 * shell — nothing here can disagree with the phone.
 *
 * Two widths, one component. At `lg` it is a 72px icon rail; at `xl` it opens to
 * 260px and the labels appear. The rail exists so that content width stays
 * continuous across 1024: a 260px sidebar at `lg` would take a 928px page down
 * to roughly 750px, so widening the window would visibly *shrink* the roster.
 * The rail costs ~24px instead.
 *
 * Labels are never removed from the DOM — `sr-only xl:not-sr-only` keeps them
 * readable to assistive tech in rail mode, which an icon-only nav otherwise
 * throws away. `title` covers the sighted mouse user.
 */
export function SideNav({
  items,
  secondary,
  brand,
  profile,
  labels,
  locale,
  appVersion,
}: SideNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const week = searchParams.get("week");

  // "CACAO ROUTE" → "CR". Derived rather than hard-coded so the rail's mark
  // cannot drift from the wordmark next to it.
  const mark = brand.name
    .split(" ")
    .map((word) => word[0])
    .join("");

  return (
    // `sticky` rather than `fixed`, and `self-start` so the flex row does not
    // stretch it: page scroll has to stay on the document, because the drawer
    // and the sheet both lock it through `document.body.style.overflow`.
    <aside className="hidden lg:flex sticky top-0 h-dvh w-18 flex-none flex-col self-start border-r border-line bg-surface xl:w-65">
      <div className="flex h-14 flex-none items-center justify-center border-b border-line xl:justify-start xl:px-4">
        <span className="text-lg font-extrabold leading-none tracking-[0.14em] text-brand xl:hidden">
          {mark}
        </span>
        <span className="hidden min-w-0 flex-col xl:flex">
          <span className="truncate text-lg font-extrabold leading-none tracking-[0.14em] text-brand">
            {brand.name}
          </span>
          <span className="truncate pt-1 text-2xs font-semibold uppercase tracking-[0.18em] text-muted">
            {brand.panel}
          </span>
        </span>
      </div>

      {/*
        One landmark holding both groups. Two `<nav>` elements would each need a
        distinct accessible name, and inventing dictionary keys for a divider is
        a worse trade than a single labelled region.
      */}
      <nav aria-label={labels.navigation} className="flex-1 overflow-y-auto px-2 py-3">
        {items.map((item) => (
          <NavRow key={item.key} item={item} pathname={pathname} week={week} />
        ))}

        <div className="my-2 border-t border-line" />

        {secondary.map((item) => (
          <NavRow key={item.key} item={item} pathname={pathname} week={week} />
        ))}
      </nav>

      <div className="flex-none border-t border-line px-2 py-3">
        <div className="flex items-center gap-2.5 px-1 pb-2 xl:px-2">
          <Avatar initials={profile.initials} solid className="rounded-full" />
          <div className="hidden min-w-0 flex-1 xl:block">
            <p className="truncate text-base font-bold">{profile.name}</p>
            <p className="truncate text-xs text-muted">{profile.role}</p>
            <p className="truncate text-2xs text-muted">{profile.email}</p>
          </div>
        </div>

        {/*
          Stacked while the rail is 72px wide — two flag chips with their codes
          will not sit side by side in that column — and a row from `xl`, where
          the sidebar opens and there is width for both.
        */}
        <LocalePicker
          current={locale.current}
          labels={locale.labels}
          className="flex-col xl:flex-row"
        />

        {/* Below a divider and in the danger tone, the same distance from the
            primary destinations the drawer keeps it at. */}
        <div className="mt-1 border-t border-line pt-1">
          <form action={signOutAction}>
            <FooterButton icon="signOut" label={labels.signOut} danger />
          </form>
        </div>

        <div className="hidden px-2 pt-2.5 xl:block">
          <p className="text-2xs text-muted">{labels.version}</p>
          <p className="tabular text-xs font-semibold text-muted">{appVersion}</p>
        </div>
      </div>
    </aside>
  );
}

function NavRow({
  item,
  pathname,
  week,
}: {
  item: NavItem;
  pathname: string;
  week: string | null;
}) {
  // The same two rules the bottom bar applies, from the same module.
  const active = isNavItemActive(pathname, item.href);

  return (
    <Link
      href={navHref(item.href, week)}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={cn(
        "relative my-0.5 flex min-h-11 items-center gap-3 rounded-md",
        "justify-center px-0 xl:justify-start xl:px-3",
        "text-base font-semibold",
        active ? "bg-brand-faint text-brand-dark" : "text-ink hover:bg-hover",
      )}
    >
      <Icon name={item.icon} />
      {/* The accessible name in rail mode; the visible label from `xl`. */}
      <span className="sr-only xl:not-sr-only xl:flex-1 xl:truncate">{item.label}</span>
      <CountBadge
        count={item.badge}
        label={item.badgeLabel ?? ""}
        // Pinned to the glyph while the row is 72px wide, in the flow once
        // there is a label to sit after.
        className="absolute right-1 top-1 xl:static"
      />
    </Link>
  );
}

function FooterButton({
  icon,
  label,
  danger = false,
}: {
  icon: "signOut";
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="submit"
      title={label}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-md",
        "justify-center px-0 xl:justify-start xl:px-3",
        "text-base font-semibold",
        danger ? "text-danger hover:bg-danger-soft" : "text-ink hover:bg-hover",
      )}
    >
      <Icon name={icon} />
      <span className="sr-only xl:not-sr-only xl:flex-1 xl:truncate xl:text-left">
        {label}
      </span>
    </button>
  );
}
