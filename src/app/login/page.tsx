import { redirect } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { getTranslations } from "@/lib/i18n/server";
import { ROUTES } from "@/lib/routes";
import { getSessionUser } from "@/server/auth/session";
import { toggleLocaleAction } from "@/server/actions/locale.actions";
import { LoginForm } from "./LoginForm";

const SHELL =
  "flex min-h-dvh w-full max-w-panel flex-col bg-surface shadow-[0_0_0_1px_var(--color-line)] " +
  "lg:min-h-0 lg:max-w-[27rem] lg:rounded-lg lg:border lg:border-line lg:shadow-md";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const [{ dict }, session, params] = await Promise.all([
    getTranslations(),
    getSessionUser(),
    searchParams,
  ]);

  if (session) redirect(ROUTES.summary);

  return (
    <div className="flex min-h-dvh justify-center bg-canvas lg:items-center lg:p-8">
      <div className={SHELL}>
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 pb-3 pt-4">
          <div className="flex flex-col gap-0.5">
            {/* Brand green, the same mark the panel header wears. */}
            <span className="text-lg font-extrabold leading-none tracking-[0.14em] text-brand">
              {dict.brand.name}
            </span>
            <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted">
              {dict.brand.panel}
            </span>
          </div>

          <form action={toggleLocaleAction}>
            {/* `md` keeps the 44px target the square version had. */}
            <Button type="submit" variant="outline">
              {dict.common.languageToggle}
            </Button>
          </form>
        </header>

        <main className="flex flex-1 flex-col px-4 pb-8 pt-8 lg:px-6">

          <LoginForm
            dict={dict}
            callbackUrl={params.callbackUrl ?? ROUTES.summary}
          />
        </main>
      </div>
    </div>
  );
}
