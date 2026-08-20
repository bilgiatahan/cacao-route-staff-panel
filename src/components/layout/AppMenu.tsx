"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useFocusTrap } from "@/components/ui/use-focus-trap";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/server/actions/auth.actions";
import { toggleLocaleAction } from "@/server/actions/locale.actions";

export interface MenuEntry {
  key: string;
  label: string;
  icon: IconName;
  href: string;
}

export interface AppMenuLabels {
  open: string;
  language: string;
  signOut: string;
  version: string;
}

export interface AppMenuProps {
  labels: AppMenuLabels;
  /** Secondary destinations only — never the primary tabs. */
  entries: MenuEntry[];
  profile: { name: string; role: string; email: string; initials: string };
  appVersion: string;
}

/**
 * The hamburger and the drawer it opens: who you are signed in as, the secondary
 * destinations, and the two account-level actions.
 *
 * It deliberately holds nothing that the bottom bar already reaches. It used to
 * repeat Summary — a primary tab — plus five rows marked "soon" that linked
 * nowhere, which made the drawer look full while offering one real destination.
 */
export function AppMenu({ labels, entries, profile, appVersion }: AppMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    // Move focus into the drawer, or a keyboard user is still on the trigger
    // behind an `inert` overlay.
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    // Captured now: by cleanup time the ref may point somewhere else.
    const trigger = triggerRef.current;

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={labels.open}
        aria-expanded={open}
        className="flex size-11 flex-none items-center justify-center rounded-md text-ink hover:bg-hover"
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>

      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-scrim transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <div className="pointer-events-none fixed inset-y-0 left-1/2 z-[99] w-full max-w-panel -translate-x-1/2">
        <aside
          ref={panelRef}
          role="dialog"
          aria-modal={open}
          aria-label={labels.open}
          inert={!open}
          className={cn(
            "pointer-events-auto flex h-full w-75 max-w-[86%] flex-col rounded-r-xl bg-surface",
            "motion-safe:transition-transform motion-safe:duration-200 ease-out",
            open ? "translate-x-0" : "-translate-x-[calc(100%+2px)]",
          )}
        >
          <div className="flex items-start gap-3 px-4 pb-4 pt-5">
            <Avatar initials={profile.initials} size="lg" solid className="rounded-full" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-extrabold">{profile.name}</p>
              <p className="truncate text-sm text-muted">{profile.role}</p>
              <p className="truncate pt-1 text-xs text-muted">{profile.email}</p>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-2">
            {entries.map((entry) => {
              const active = pathname === entry.href;

              return (
                <Link
                  key={entry.key}
                  href={entry.href}
                  // Navigating from inside the drawer should leave it behind.
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "my-1 flex min-h-11 w-full items-center gap-3 rounded-md px-4 text-left",
                    "text-base font-semibold hover:bg-hover",
                    active ? "bg-brand-faint text-brand-dark" : "text-ink",
                  )}
                >
                  <Icon name={entry.icon} />
                  <span className="flex-1 truncate">{entry.label}</span>
                  <Icon name="chevronRight" className="h-4 w-4 text-muted" />
                </Link>
              );
            })}

            <div className="mt-1 border-t border-line pt-2">
              <form action={toggleLocaleAction}>
                <button
                  type="submit"
                  className="flex min-h-11 w-full items-center gap-3 rounded-md px-4 text-left text-base font-semibold hover:bg-hover"
                >
                  <Icon name="globe" />
                  <span className="flex-1 truncate">{labels.language}</span>
                </button>
              </form>
            </div>

            <div className="mt-1 border-t border-line pt-2">
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex min-h-11 w-full items-center gap-3 rounded-md px-4 text-left text-base font-bold text-danger hover:bg-danger-soft"
                >
                  <Icon name="signOut" />
                  <span className="flex-1 truncate">{labels.signOut}</span>
                </button>
              </form>
            </div>
          </nav>

          <div className="border-t border-line px-4 pb-6 pt-3">
            <p className="text-2xs text-muted">{labels.version}</p>
            <p className="tabular text-xs font-semibold text-muted">{appVersion}</p>
          </div>
        </aside>
      </div>
    </>
  );
}
