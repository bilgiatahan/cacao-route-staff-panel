import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { getTranslations } from "@/lib/i18n/server";
import { ROUTES } from "@/lib/routes";

/**
 * Reached when a page calls `notFound()` — today that is an unknown employee id
 * on the team detail route, which until now rendered Next's unstyled default.
 */
export default async function PanelNotFound() {
  const { dict } = await getTranslations();

  return (
    <section className="flex flex-1 flex-col gap-3.5 px-4 pb-6 pt-3.5">
      <Card className="flex flex-col items-start gap-3 px-4 py-5">
        <span className="flex size-10 items-center justify-center rounded-md bg-fill-strong text-muted">
          <Icon name="notFound" className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold">{dict.notFound.title}</h1>
          <p className="mt-1 text-base text-muted">{dict.notFound.body}</p>
        </div>
        <Link
          href={ROUTES.summary}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2.5 text-sm font-bold text-white hover:bg-brand-dark"
        >
          {dict.notFound.action}
        </Link>
      </Card>
    </section>
  );
}
