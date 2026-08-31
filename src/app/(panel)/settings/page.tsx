import { PageShell } from "@/components/layout/PageShell";
import { SettingsForm } from "@/components/features/settings/SettingsForm";
import { PageHeader } from "@/components/ui/Section";
import { getTranslations } from "@/lib/i18n/server";
import { requireAdmin } from "@/server/auth/session";
import { actionErrorMessages } from "@/server/actions/action-result";
import { updateSettingsAction } from "@/server/actions/settings.actions";
import { getAppSettings } from "@/server/services/settings.service";

/**
 * Panel settings — admin only.
 *
 * `requireAdmin` redirects rather than 404s, and it runs before the settings are
 * read: a member of staff should never be able to learn the state of a switch
 * they are the subject of.
 */
export default async function SettingsPage() {
  const [{ dict }] = await Promise.all([getTranslations(), requireAdmin()]);
  const settings = await getAppSettings();

  return (
    // Card family, `medium` measure: it is a form, and a form wants a short line
    // however wide the monitor is — the same call Profile makes.
    <PageShell width="medium">
      <section className="flex flex-1 flex-col gap-3.5 bg-fill px-4 pb-6 pt-3.5">
        <PageHeader
          variant="plain"
          title={dict.settings.title}
          subtitle={dict.settings.subtitle}
        />

        <SettingsForm
          staffCanSeePay={settings.staffCanSeePay}
          labels={{
            section: dict.settings.visibility,
            staffCanSeePay: dict.settings.staffCanSeePay,
            staffCanSeePayHint: dict.settings.staffCanSeePayHint,
            on: dict.settings.on,
            off: dict.settings.off,
            save: dict.common.save,
            saving: dict.common.saving,
            saved: dict.settings.saved,
            close: dict.common.close,
          }}
          messages={actionErrorMessages(dict)}
          action={updateSettingsAction}
        />
      </section>
    </PageShell>
  );
}
