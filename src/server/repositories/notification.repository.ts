import "server-only";

import type {
  Localized,
  Notification,
  NotificationAudience,
  SessionUser,
} from "@/types/domain";
import type {
  NotificationModel as NotificationRow,
  NotificationReadModel as NotificationReadRow,
} from "@/generated/prisma/models";

import { createId, isPrismaErrorCode, prisma } from "../db/client";

export interface NotificationDraft {
  title: Localized;
  body: Localized;
  audience: NotificationAudience;
}

type RowWithReads = NotificationRow & { reads: Pick<NotificationReadRow, "employeeId">[] };

/**
 * The audience filter that used to be a JS predicate. Expressed as a `where`
 * clause it also powers `countUnread` and `markAllRead` without loading rows.
 */
function visibleTo(viewer: SessionUser) {
  return {
    OR: [
      { audienceKind: "all" as const },
      ...(viewer.role === "admin" ? [{ audienceKind: "admins" as const }] : []),
      { audienceKind: "employee" as const, audienceEmployeeId: viewer.employeeId },
    ],
  };
}

function toAudience(row: NotificationRow): NotificationAudience {
  switch (row.audienceKind) {
    case "all":
      return { kind: "all" };
    case "admins":
      return { kind: "admins" };
    case "employee":
      // The column is nullable in the schema but always set for this kind; fall
      // back to an empty id rather than crashing a notification list.
      return { kind: "employee", employeeId: row.audienceEmployeeId ?? "" };
  }
}

function toNotification(row: RowWithReads): Notification {
  return {
    id: row.id,
    title: { tr: row.titleTr, en: row.titleEn },
    body: { tr: row.bodyTr, en: row.bodyEn },
    createdAt: row.createdAt.toISOString(),
    audience: toAudience(row),
    readBy: row.reads.map((read) => read.employeeId),
  };
}

export const notificationRepository = {
  /** Newest first, filtered to what this viewer is allowed to see. */
  async listForViewer(viewer: SessionUser): Promise<Notification[]> {
    const rows = await prisma.notification.findMany({
      where: visibleTo(viewer),
      orderBy: { createdAt: "desc" },
      include: { reads: { select: { employeeId: true } } },
    });
    return rows.map(toNotification);
  },

  async countUnread(viewer: SessionUser): Promise<number> {
    return prisma.notification.count({
      where: {
        ...visibleTo(viewer),
        reads: { none: { employeeId: viewer.employeeId } },
      },
    });
  },

  async create(draft: NotificationDraft): Promise<Notification> {
    const row = await prisma.notification.create({
      data: {
        id: createId("note"),
        titleTr: draft.title.tr,
        titleEn: draft.title.en,
        bodyTr: draft.body.tr,
        bodyEn: draft.body.en,
        createdAt: new Date(),
        audienceKind: draft.audience.kind,
        audienceEmployeeId:
          draft.audience.kind === "employee" ? draft.audience.employeeId : null,
      },
      include: { reads: { select: { employeeId: true } } },
    });
    return toNotification(row);
  },

  async markRead(id: string, employeeId: string): Promise<boolean> {
    try {
      await prisma.notificationRead.create({ data: { notificationId: id, employeeId } });
      return true;
    } catch (error) {
      // Already read — the composite primary key rejects the duplicate, which is
      // the same "nothing changed" answer the array version returned.
      if (isPrismaErrorCode(error, "P2002")) return false;
      // Unknown notification id.
      if (isPrismaErrorCode(error, "P2003")) return false;
      throw error;
    }
  },

  async markAllRead(viewer: SessionUser): Promise<number> {
    const unread = await prisma.notification.findMany({
      where: {
        ...visibleTo(viewer),
        reads: { none: { employeeId: viewer.employeeId } },
      },
      select: { id: true },
    });
    if (unread.length === 0) return 0;

    const { count } = await prisma.notificationRead.createMany({
      data: unread.map((row) => ({ notificationId: row.id, employeeId: viewer.employeeId })),
      skipDuplicates: true,
    });
    return count;
  },
};
