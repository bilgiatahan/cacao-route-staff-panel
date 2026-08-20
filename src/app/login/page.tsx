import { redirect } from "next/navigation";

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

function emailFor(employeeId: string): string {
  return EMPLOYEE_BLUEPRINTS.find((row) => row.id === employeeId)?.email ?? "";
}

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

  const adminEmail = emailFor(ADMIN_EMPLOYEE_ID);
  const staffEmail = emailFor(DEMO_STAFF_EMPLOYEE_ID);

  return (
    <div className="flex min-h-dvh justify-center bg-canvas">
      <div className="flex min-h-dvh w-full max-w-panel flex-col bg-surface shadow-[0_0_0_1px_var(--color-line)]">
        <header className="flex items-center justify-between gap-3 border-b-2 border-ink px-4 pb-3 pt-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-extrabold leading-none tracking-[0.14em]">
              {dict.brand.name}
            </span>
            <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted">
              {dict.brand.panel}
            </span>
          </div>

          <form action={toggleLocaleAction}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center border border-line-strong bg-surface px-2.5 text-xs font-bold tracking-[0.08em] text-ink hover:bg-hover"
            >
              {dict.common.languageToggle}
            </button>
          </form>
        </header>

        <main className="flex flex-1 flex-col px-4 pb-8 pt-8">
          <h1 className="text-4xl font-bold">{dict.auth.title}</h1>
          <p className="mb-6 mt-1 text-sm text-muted">{dict.auth.subtitle}</p>

          <LoginForm
            dict={dict}
            callbackUrl={params.callbackUrl ?? ROUTES.summary}
            defaultEmail={adminEmail}
          />

          <section className="mt-8 border-t-2 border-ink pt-3">
            <h2 className="label-eyebrow">{dict.auth.demoTitle}</h2>
            <dl className="mt-2 flex flex-col gap-1 text-sm">
              <div className="flex justify-between gap-3 border-b border-line py-1.5">
                <dt className="font-semibold">{dict.auth.demoAdmin}</dt>
                <dd className="tabular text-muted">{adminEmail}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line py-1.5">
                <dt className="font-semibold">{dict.auth.demoStaff}</dt>
                <dd className="tabular text-muted">{staffEmail}</dd>
              </div>
              <div className="flex justify-between gap-3 py-1.5">
                <dt className="font-semibold">{dict.auth.password}</dt>
                <dd className="tabular text-muted">{DEMO_PASSWORD}</dd>
              </div>
            </dl>
          </section>
        </main>
      </div>
    </div>
  );
}
