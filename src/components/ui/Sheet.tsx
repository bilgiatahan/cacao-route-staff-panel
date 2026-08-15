"use client";

import { useEffect, type ReactNode } from "react";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  closeLabel: string;
  children: ReactNode;
}

/**
 * Bottom sheet used for the shift editor. Locks background scroll and closes
 * on Escape or a click on the scrim.
 */
export function Sheet({ open, onClose, title, subtitle, closeLabel, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-40 bg-[rgba(32,30,29,0.45)]"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[560px] -translate-x-1/2 border-t-2 border-ink bg-surface px-4 pb-6 pt-4"
      >
        <div className="mb-3.5 flex items-baseline justify-between gap-2.5">
          <div className="min-w-0">
            <div className="text-2xl font-extrabold -tracking-[0.01em]">{title}</div>
            {subtitle ? <div className="text-xs text-muted">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex-none px-1 py-0.5 text-2xl leading-none text-muted hover:text-ink"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </>
  );
}
