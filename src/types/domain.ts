/**
 * Domain model for the shift panel.
 *
 * Everything is storage-agnostic: dates are ISO `YYYY-MM-DD` strings and times
 * are minutes from midnight, so the same shapes survive a move from the
 * in-memory store to a real database without touching the UI.
 */

/** `YYYY-MM-DD` */
export type IsoDate = string;

/** `YYYY-MM` — a calendar month, the reporting period. */
export type IsoMonth = string;

/** Full ISO-8601 timestamp. */
export type IsoDateTime = string;

export type UserRole = "admin" | "staff";
export type ContractType = "full" | "part";
export type LeaveType = "annual" | "sick" | "excuse";
export type RequestStatus = "pending" | "approved" | "rejected";
export type Locale = "tr" | "en";

/** A string that has a translation per supported locale. */
export type Localized = Record<Locale, string>;

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  /** Job title, translated. */
  position: Localized;
  /** Hourly wage in GBP. */
  hourlyRate: number;
  contract: ContractType;
  birthDate: IsoDate | null;
  hiredAt: IsoDate | null;
  /** Remaining annual leave, in days. */
  leaveBalance: number;
  phone: string;
  email: string;
  address: string;
  role: UserRole;
  /**
   * Pseudo-employees such as "Cleaning" occupy a roster row and can be
   * scheduled, but are excluded from headcount, payroll and leave.
   */
  isTaskRow: boolean;
  archivedAt: IsoDateTime | null;
}

export interface Shift {
  id: string;
  employeeId: string;
  date: IsoDate;
  /** Minutes from midnight, e.g. 480 for 08:00. */
  startMinutes: number;
  endMinutes: number;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: IsoDate;
  endDate: IsoDate;
  note: string;
  status: RequestStatus;
  createdAt: IsoDateTime;
  decidedAt: IsoDateTime | null;
  decidedByEmployeeId: string | null;
}

export interface SwapRequest {
  id: string;
  /** Employee giving up the shift. */
  requesterId: string;
  /** Employee asked to take it. */
  targetId: string;
  date: IsoDate;
  status: RequestStatus;
  createdAt: IsoDateTime;
  decidedAt: IsoDateTime | null;
}

/** Who a notification is addressed to. */
export type NotificationAudience =
  | { kind: "all" }
  | { kind: "admins" }
  | { kind: "employee"; employeeId: string };

export interface Notification {
  id: string;
  title: Localized;
  body: Localized;
  createdAt: IsoDateTime;
  audience: NotificationAudience;
  /** Employee ids that have read it. */
  readBy: string[];
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  employeeId: string;
}

/** Everything a session needs, resolved once per request. */
export interface SessionUser {
  userId: string;
  employeeId: string;
  email: string;
  role: UserRole;
  fullName: string;
}

/**
 * Panel-wide settings the admin controls, one set for the whole café.
 *
 * Deliberately not per-employee: "can staff see what they earn" is a policy of
 * the business, not a property of a person, and a per-person switch would make
 * two baristas standing next to each other see different screens with no way
 * for either of them to know why.
 */
export interface AppSettings {
  /**
   * When false, staff see neither the pay card on their summary nor the payroll
   * screen. An admin always sees pay — they are the ones setting it.
   */
  staffCanSeePay: boolean;
}
