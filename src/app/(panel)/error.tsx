"use client";

import { useEffect, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { LOCALE_COOKIE } from "@/lib/constants";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";
import type { Locale } from "@/types/domain";

/**
 * Catches anything a panel page throws while rendering.
 *
 * An error boundary has to be a Client Component, so it cannot call
 * `getTranslations()` and cannot receive props beyond `error` / `reset`. Rather
 * than ship both ~300-key dictionaries to the client for four sentences, the
 * copy lives here and the language comes from the same `cr_locale` cookie the
 * server reads. This is the one place the project's "format on the server" rule
 * does not apply, because there is no server render to format in.
 */
const COPY: Record<Locale, { title: string; body: string; retry: string }> = {
  tr: {
    title: "Bu sayfa yüklenemedi",
    body: "Bağlantı kopmuş olabilir. Tekrar denemek sorunu genelde çözer.",
    retry: "Tekrar dene",
  },
  en: {
    title: "This page could not load",
    body: "The connection may have dropped. Trying again usually fixes it.",
    retry: "Try again",
  },
};

/** The cookie cannot change while an error boundary is mounted. */
function subscribeToNothing(): () => void {
  return () => {};
}

function readLocale(): Locale {
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : undefined;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // The cookie is external, non-reactive state: read it directly rather than
  // syncing it into React state from an effect. The server snapshot falls back
  // to the source locale, since `document` does not exist there.
  const locale = useSyncExternalStore(subscribeToNothing, readLocale, () => DEFAULT_LOCALE);

  useEffect(() => {
    // The digest is the only handle on the server-side stack, so keep it.
    console.error("panel render failed", error.digest ?? error.message);
  }, [error]);

  const copy = COPY[locale];

  return (
    <section className="flex flex-1 flex-col gap-3.5 px-4 pb-6 pt-3.5">
      <Card className="flex flex-col items-start gap-3 px-4 py-5">
        <span className="flex size-10 items-center justify-center rounded-md bg-danger-soft text-danger">
          <Icon name="alert" className="h-5 w-5" />
        </span>
        <div role="alert">
          <h1 className="text-2xl font-extrabold">{copy.title}</h1>
          <p className="mt-1 text-base text-muted">{copy.body}</p>
        </div>
        <Button size="lg" onClick={reset} className="gap-2 rounded-md">
          <Icon name="retry" className="h-4 w-4" />
          {copy.retry}
        </Button>
      </Card>
    </section>
  );
}
