"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/server/actions/auth.actions";
import { toggleLocaleAction } from "@/server/actions/locale.actions";

export interface MenuEntry {
  key: string;
  label: string;
  icon: IconName;
  /** Omitted while the destination does not exist yet; the row reads as "soon". */
  href?: string;
}

export interface AppMenuLabels {
  open: string;
  close: string;
  language: string;
  signOut: string;
  version: string;
  soon: string;
}

export interface AppMenuProps {
  labels: AppMenuLabels;
  /** Rendered in order, with a rule between groups. */
  groups: MenuEntry[][];
  profile: { name: string; role: string; email: string; initials: string };
  appVersion: string;
}

/**
 * The hamburger button and the drawer it opens: who you are signed in as, the
 * account links, and the two account-level actions (language, sign out) that
 * used to sit in the header.
 */
export function AppMenu({ labels, groups, profile, appVersion }: AppMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={labels.open}
        aria-expanded={open}
        className="flex size-9 flex-none items-center justify-center text-ink hover:bg-hover"
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>

      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-[rgba(32,30,29,0.45)] transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <div className="pointer-events-none fixed inset-y-0 left-1/2 z-[99] w-full max-w-140 -translate-x-1/2">
        <aside
          role="dialog"
          aria-modal={open}
          aria-label={labels.open}
          inert={!open}
          className={cn(
            "pointer-events-auto flex h-full w-75 max-w-[86%] flex-col rounded-tr-[1rem] rounded-br-[1rem] bg-surface transition-transform duration-200 ease-out",
            open ? "translate-x-0" : "-translate-x-[calc(100%+2px)]",
          )}
        >
          <div className="flex items-start gap-3 px-4 pb-4 pt-5">
            <Avatar initials={profile.initials} size="lg" solid className="rounded-full" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-extrabold">{profile.name}</p>
              <p className="truncate text-sm text-muted">{profile.role}</p>
              <p className="truncate pt-1 text-xs text-muted-soft">{profile.email}</p>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-2 px-4">
            {groups.map((group, index) => (
              <div
                key={group[0]?.key ?? index}
                className={cn("py-1", index > 0 && "border-t border-line")}
              >
                {group.map((entry) => {
                  const active = entry.href ? pathname === entry.href : false;

                  const body = (
                    <>
                      <Icon
                        name={entry.icon}
                        className={entry.href ? undefined : "text-muted-soft"}
                      />
                      <span className="flex-1 truncate">{entry.label}</span>
                      {entry.href ? (
                        <Icon
                          name="chevronRight"
                          className="h-3.5 w-3.5 text-muted-soft"
                        />
                      ) : (
                        <span className="flex-none bg-fill-strong px-1.5 py-0.5 text-nano font-extrabold uppercase tracking-[0.08em] text-muted">
                          {labels.soon}
                        </span>
                      )}
                    </>
                  );

                  const className = cn(
                    "flex w-full items-center gap-3 px-4 py-3 my-2 text-left text-base font-semibold",
                    active
                      ? "bg-brand-faint pl-[14px] text-brand-dark rounded-lg"
                      : "text-ink",
                    entry.href ? "hover:bg-hover" : "cursor-default text-muted",
                  );

                  return entry.href ? (
                    <Link
                      key={entry.key}
                      href={entry.href}
                      // Navigating from inside the drawer should leave it behind.
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={className}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div key={entry.key} aria-disabled className={className}>
                      {body}
                    </div>
                  );
                })}
              </div>
            ))}

            <div className="border-t border-line py-1">
              <form action={toggleLocaleAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-base font-semibold hover:bg-hover"
                >
                  <Icon name="globe" />
                  <span className="flex-1 truncate">{labels.language}</span>
                  <Icon name="chevronRight" className="h-3.5 w-3.5 text-muted-soft" />
                </button>
              </form>
            </div>

            <div className="border-t border-line py-1">
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-base font-bold text-red-700 hover:bg-hover"
                >
                  <Icon name="signOut" />
                  <span className="flex-1 truncate">{labels.signOut}</span>
                </button>
              </form>
            </div>
          </nav>

          <div className="border-t border-line px-4 pb-6 pt-3">
            <p className="text-2xs text-muted-soft">{labels.version}</p>
            <p className="tabular text-xs font-semibold text-muted">{appVersion}</p>
          </div>
        </aside>
      </div>
    </>
  );
}
