import { MarkAllReadButton } from "@/components/features/notifications/MarkAllReadButton";
import { PageShell } from "@/components/layout/PageShell";
import { NotificationList } from "@/components/features/notifications/NotificationList";
import { PageHeader } from "@/components/ui/Section";
import { formatRelativeTime } from "@/lib/format";
import { getTranslations } from "@/lib/i18n/server";
import { actionErrorMessages } from "@/server/actions/action-result";
import { requireSessionUser } from "@/server/auth/session";
import { notificationRepository } from "@/server/repositories/notification.repository";

/** The page owns the tint and the gutter; every row inside is a Card. */
const PAGE = "flex flex-1 flex-col gap-3.5 bg-fill px-4 pb-6 pt-3.5";

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
    // A list of sentences: one column, capped at a reading measure.
    <PageShell width="medium">
      <section className={PAGE}>
        <PageHeader
          variant="plain"
          title={dict.notifications.title}
          subtitle={unread > 0 ? `${unread} ${dict.notifications.unread}` : undefined}
          action={
            <MarkAllReadButton
              label={dict.notifications.markAll}
              disabled={unread === 0}
              errorMessages={actionErrorMessages(dict)}
            />
          }
        />
        <NotificationList
          items={items}
          emptyLabel={dict.notifications.empty}
          unreadLabel={dict.notifications.unread}
          errorMessages={actionErrorMessages(dict)}
        />
      </section>
    </PageShell>
  );
}
