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

  /*
    Seed accounts are a development affordance and never a production one. The
    card below prints a working password in plain text and the email field above
    pre-fills the administrator's address, so on a deployed panel the sign-in
    page would hand both halves of an admin credential to anyone who loaded it.
    One flag gates both, and it is read on the server, so nothing about the demo
    accounts reaches a production response at all.
  */
  const showDemoAccounts = process.env.NODE_ENV !== "production";

  const demoRows: DetailItem[] = showDemoAccounts
    ? [
        {
          key: "admin",
          icon: "shield",
          label: dict.auth.demoAdmin,
          value: emailFor(ADMIN_EMPLOYEE_ID),
        },
        {
          key: "staff",
          icon: "user",
          label: dict.auth.demoStaff,
          value: emailFor(DEMO_STAFF_EMPLOYEE_ID),
        },
        { key: "password", icon: "lock", label: dict.auth.password, value: DEMO_PASSWORD },
      ]
    : [];

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
          <h1 className="text-4xl font-bold">{dict.auth.title}</h1>
          <p className="mb-6 mt-1 text-sm text-muted">{dict.auth.subtitle}</p>

          <LoginForm
            dict={dict}
            callbackUrl={params.callbackUrl ?? ROUTES.summary}
            defaultEmail={showDemoAccounts ? emailFor(ADMIN_EMPLOYEE_ID) : ""}
          />

          {/*
            Demoted on purpose: a dashed border on the page tint, no elevation,
            and a small eyebrow rather than a section rule. These are seed
            accounts, and the previous treatment — a formal definition list
            under a 2px ink rule — gave them the weight of production records.
          */}
          {showDemoAccounts ? (
            <section className="mt-8">
              <Card padding="md" className="border-dashed bg-fill">
                <p className="label-eyebrow flex items-center gap-1.5">
                  <Icon name="info" className="h-3.5 w-3.5" />
                  {dict.auth.demoTitle}
                </p>
                <DetailList items={demoRows} />
              </Card>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
