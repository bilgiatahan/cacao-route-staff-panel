import { redirect } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DetailList, type DetailItem } from "@/components/ui/DetailList";
import { Icon } from "@/components/ui/Icon";
import { getTranslations } from "@/lib/i18n/server";
import { ROUTES } from "@/lib/routes";
import { getSessionUser } from "@/server/auth/session";
import { toggleLocaleAction } from "@/server/actions/locale.actions";
import {
  ADMIN_EMPLOYEE_ID,
  DEMO_PASSWORD,
  DEMO_STAFF_EMPLOYEE_ID,
  EMPLOYEE_BLUEPRINTS,
} from "@/server/db/seed-data";

import { LoginForm } from "./LoginForm";

/**
 * A phone column that becomes a centred card. The hairline ring is the mobile
 * frame the panel uses; from `lg` a real card surface replaces it.
 */
const SHELL =
  "flex min-h-dvh w-full max-w-panel flex-col bg-surface shadow-[0_0_0_1px_var(--color-line)] " +
  "lg:min-h-0 lg:max-w-[27rem] lg:rounded-lg lg:border lg:border-line lg:shadow-md";

function emailFor(employeeId: string): string {
  return EMPLOYEE_BLUEPRINTS.find((row) => row.id === employeeId)?.email ?? "";
}

/**
 * Sign-in, on its own shell but in the product's own language.
 *
 * It kept the framing the panel has since dropped — 2px ink rules top and
 * bottom, a square bordered locale toggle, ink-coloured brand type, square
 * controls — so it read as an older screen than the thing behind it. Same
 * layout, same fields, same behaviour; English Green brand mark, hairline
 * borders, the shared `Button`, and soft controls on the radius ladder.
 *
 * From `lg` the full-height phone column becomes a centred card, because a
 * 560px strip pinned to the top-left of a monitor is a mobile shell someone
 * forgot to finish, not a desktop sign-in.
 */
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
