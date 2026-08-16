import type { IsoDate } from "@/types/domain";

export const ROUTES = {
  login: "/login",
  summary: "/summary",
  timetable: "/timetable",
  leave: "/leave",
  team: "/team",
  teamMember: (employeeId: string) => `/team/${employeeId}`,
  teamNew: "/team/new",
  notifications: "/notifications",
  profile: "/profile",
} as const;

/** Every path that requires an authenticated session. */
export const PROTECTED_PREFIXES = [
  ROUTES.summary,
  ROUTES.timetable,
  ROUTES.leave,
  ROUTES.team,
  ROUTES.notifications,
  ROUTES.profile,
];

export type PanelSearchParams = {
  week?: IsoDate;
  view?: string;
  day?: string;
  period?: string;
};

/** Builds a panel URL that carries the current week and view state. */
export function panelHref(pathname: string, params: PanelSearchParams = {}): string {
  const search = new URLSearchParams();
  if (params.week) search.set("week", params.week);
  if (params.view) search.set("view", params.view);
  if (params.day) search.set("day", params.day);
  if (params.period) search.set("period", params.period);
  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}
