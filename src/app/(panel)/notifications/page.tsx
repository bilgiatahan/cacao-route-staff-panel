import { MarkAllReadButton } from "@/components/features/notifications/MarkAllReadButton";
import { PageShell } from "@/components/layout/PageShell";
import { NotificationList } from "@/components/features/notifications/NotificationList";
import { PageHeader, RuledList } from "@/components/ui/Section";
import { formatRelativeTime } from "@/lib/format";
import { getTranslations } from "@/lib/i18n/server";
import { actionErrorMessages } from "@/server/actions/action-result";
import { requireSessionUser } from "@/server/auth/session";
import { notificationRepository } from "@/server/repositories/notification.repository";

export default async function NotificationsPage() {
  const [{ locale, dict }, user] = await Promise.all([
    getTranslations(),
    requireSessionUser(),
  ]);

  const notifications = await notificationRepository.listForViewer(user);
  const items = notifications.map((notification) => ({
    id: notification.id,
    title: notification.title[locale],
    body: notification.body[locale],
    when: formatRelativeTime(notification.createdAt, dict),
    read: notification.readBy.includes(user.employeeId),
  }));

  const unread = items.filter((item) => !item.read).length;

  return (
    <PageShell>
      <section className="flex flex-1 flex-col">
        <PageHeader
          title={dict.notifications.title}
          action={
            <MarkAllReadButton
              label={dict.notifications.markAll}
              disabled={unread === 0}
              errorMessages={actionErrorMessages(dict)}
            />
          }
        />
        <RuledList>
          <NotificationList
            items={items}
            emptyLabel={dict.notifications.empty}
            errorMessages={actionErrorMessages(dict)}
          />
        </RuledList>
      </section>
    </PageShell>
  );
}
