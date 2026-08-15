import "server-only";

import { fromIsoDate } from "@/lib/date";
import { formatDateRange } from "@/lib/format";
import { getDictionary, interpolate, LOCALES } from "@/lib/i18n";
import { notificationRepository } from "@/server/repositories/notification.repository";
import type {
  Employee,
  IsoDate,
  LeaveRequest,
  Locale,
  Localized,
  NotificationAudience,
  SwapRequest,
} from "@/types/domain";

type EventKey = keyof ReturnType<typeof getDictionary>["events"];

/** Renders one event template into every supported locale. */
function localize(
  event: EventKey,
  values: (locale: Locale) => Record<string, string>,
): { title: Localized; body: Localized } {
  const title = {} as Localized;
  const body = {} as Localized;

  for (const locale of LOCALES) {
    const dict = getDictionary(locale);
    const template = dict.events[event];
    const slots = values(locale);
    title[locale] = interpolate(template.title, slots);
    body[locale] = interpolate(template.body, slots);
  }

  return { title, body };
}

function displayName(employee: Employee | null, locale: Locale): string {
  if (!employee) return "—";
  return employee.displayName?.[locale] ?? employee.firstName;
}

function dayName(date: IsoDate, locale: Locale): string {
  const dict = getDictionary(locale);
  const index = fromIsoDate(date).getDay();
  return dict.calendar.daysLong[index === 0 ? 6 : index - 1];
}

async function push(
  event: EventKey,
  audience: NotificationAudience,
  values: (locale: Locale) => Record<string, string>,
): Promise<void> {
  const { title, body } = localize(event, values);
  await notificationRepository.create({ title, body, audience });
}

export const notificationService = {
  async leaveRequested(employee: Employee, request: LeaveRequest): Promise<void> {
    await push("leaveRequested", { kind: "admins" }, (locale) => {
      const dict = getDictionary(locale);
      return {
        name: displayName(employee, locale),
        range: formatDateRange(request.startDate, request.endDate, dict),
        type: dict.leave.types[request.type],
      };
    });
  },

  async leaveDecided(employee: Employee, request: LeaveRequest): Promise<void> {
    const event: EventKey = request.status === "approved" ? "leaveApproved" : "leaveRejected";
    await push(event, { kind: "employee", employeeId: employee.id }, (locale) => ({
      name: displayName(employee, locale),
      range: formatDateRange(request.startDate, request.endDate, getDictionary(locale)),
    }));
  },

  async swapRequested(
    requester: Employee,
    target: Employee,
    request: SwapRequest,
  ): Promise<void> {
    await push("swapRequested", { kind: "admins" }, (locale) => ({
      name: displayName(requester, locale),
      day: dayName(request.date, locale),
      target: displayName(target, locale),
    }));
  },

  async swapDecided(request: SwapRequest): Promise<void> {
    await push("swapDecided", { kind: "all" }, (locale) => {
      const dict = getDictionary(locale);
      const status =
        request.status === "approved" ? dict.leave.status.approved : dict.leave.status.rejected;
      return { day: dayName(request.date, locale), status };
    });
  },
};
