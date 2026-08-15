import type { ContractType, UserRole } from "@/types/domain";

/** `[startHour, endHour]` or `null` for a day off, Monday-first. */
export type ShiftTemplate = [number, number] | null;

export interface EmployeeBlueprint {
  id: string;
  firstName: string;
  lastName: string;
  positionTr: string;
  positionEn: string;
  hourlyRate: number;
  contract: ContractType;
  birthDate: string | null;
  hiredAt: string | null;
  leaveBalance: number;
  phone: string;
  email: string;
  address: string;
  role: UserRole;
  isTaskRow?: boolean;
  /** Task rows show a translated label instead of a person's name. */
  displayNameEn?: string;
  /** Recurring weekly pattern, Monday → Sunday. */
  template: ShiftTemplate[];
}

/** Shared credential for every demo account. */
export const DEMO_PASSWORD = "cacao123";

export const EMPLOYEE_BLUEPRINTS: EmployeeBlueprint[] = [
  {
    id: "emp-1",
    firstName: "Ahmed",
    lastName: "Karim",
    positionTr: "Barista",
    positionEn: "Barista",
    hourlyRate: 145,
    contract: "full",
    birthDate: "1998-04-12",
    hiredAt: "2024-02-05",
    leaveBalance: 11,
    phone: "+90 532 118 4407",
    email: "ahmed@cacaoroute.co",
    address: "Caferağa Mah. Dr. Esat Işık Cad. 42/5, Kadıköy, İstanbul",
    role: "staff",
    template: [
      [8, 16],
      [10, 19],
      [8, 16],
      [7, 16],
      null,
      [9, 17],
      [10, 18],
    ],
  },
  {
    id: "emp-2",
    firstName: "Anima",
    lastName: "Shrestha",
    positionTr: "Vardiya Amiri",
    positionEn: "Shift Lead",
    hourlyRate: 185,
    contract: "full",
    birthDate: "1993-09-30",
    hiredAt: "2022-06-01",
    leaveBalance: 6,
    phone: "+90 533 204 9912",
    email: "anima@cacaoroute.co",
    address: "Osmanağa Mah. Söğütlüçeşme Cad. 9/3, Kadıköy, İstanbul",
    role: "admin",
    template: [
      [10, 19],
      [7, 16],
      [12, 19],
      [10, 19],
      [10, 19],
      [12, 19],
      null,
    ],
  },
  {
    id: "emp-3",
    firstName: "Angila",
    lastName: "Thapa",
    positionTr: "Barista",
    positionEn: "Barista",
    hourlyRate: 135,
    contract: "part",
    birthDate: "2001-01-22",
    hiredAt: "2025-11-17",
    leaveBalance: 4,
    phone: "+90 545 771 3028",
    email: "angila@cacaoroute.co",
    address: "Rasimpaşa Mah. Uzunhafız Sok. 17/2, Kadıköy, İstanbul",
    role: "staff",
    template: [null, null, [13, 19], null, [13, 19], null, null],
  },
  {
    id: "emp-4",
    firstName: "Ella",
    lastName: "Novak",
    positionTr: "Kasiyer",
    positionEn: "Cashier",
    hourlyRate: 130,
    contract: "part",
    birthDate: "2000-07-08",
    hiredAt: "2025-03-24",
    leaveBalance: 9,
    phone: "+90 537 610 5583",
    email: "ella@cacaoroute.co",
    address: "Fenerbahçe Mah. Fener Kalamış Cad. 88/7, Kadıköy, İstanbul",
    role: "staff",
    template: [
      [11, 16],
      null,
      null,
      [11, 16],
      [15, 19],
      [8, 16],
      [9, 16],
    ],
  },
  {
    id: "emp-5",
    firstName: "Veronica",
    lastName: "Ilić",
    positionTr: "Pastane",
    positionEn: "Pastry",
    hourlyRate: 155,
    contract: "part",
    birthDate: "1995-12-03",
    hiredAt: "2023-09-11",
    leaveBalance: 13,
    phone: "+90 531 442 7719",
    email: "veronica@cacaoroute.co",
    address: "Göztepe Mah. Bağdat Cad. 214/4, Kadıköy, İstanbul",
    role: "staff",
    template: [null, [7, 13], null, null, [7, 13], null, [10, 16]],
  },
  {
    id: "emp-6",
    firstName: "Annabel",
    lastName: "Fischer",
    positionTr: "Barista",
    positionEn: "Barista",
    hourlyRate: 135,
    contract: "part",
    birthDate: "1999-05-19",
    hiredAt: "2025-07-02",
    leaveBalance: 7,
    phone: "+90 546 903 2264",
    email: "annabel@cacaoroute.co",
    address: "Zühtüpaşa Mah. Şair Nefi Sok. 6/1, Kadıköy, İstanbul",
    role: "staff",
    template: [[9, 15], null, null, null, null, [14, 19], null],
  },
  {
    id: "emp-7",
    firstName: "Erin",
    lastName: "O'Connor",
    positionTr: "Barista",
    positionEn: "Barista",
    hourlyRate: 138,
    contract: "part",
    birthDate: "2002-10-27",
    hiredAt: "2026-01-19",
    leaveBalance: 3,
    phone: "+90 539 337 1145",
    email: "erin@cacaoroute.co",
    address: "Koşuyolu Mah. Kuzu Sok. 31/9, Kadıköy, İstanbul",
    role: "staff",
    template: [null, [8, 14], null, null, null, [10, 15], null],
  },
  {
    id: "emp-8",
    firstName: "Bushra",
    lastName: "Ahmed",
    positionTr: "Vardiya Amiri",
    positionEn: "Shift Lead",
    hourlyRate: 180,
    contract: "full",
    birthDate: "1994-03-15",
    hiredAt: "2023-01-09",
    leaveBalance: 8,
    phone: "+90 542 556 8830",
    email: "bushra@cacaoroute.co",
    address: "Acıbadem Mah. Sarımeşe Sok. 12/6, Kadıköy, İstanbul",
    role: "staff",
    template: [
      [12, 19],
      [11, 19],
      [7, 16],
      null,
      [8, 17],
      [12, 19],
      [11, 16],
    ],
  },
  {
    id: "emp-9",
    firstName: "Rumesh",
    lastName: "Perera",
    positionTr: "Pastane",
    positionEn: "Pastry",
    hourlyRate: 150,
    contract: "full",
    birthDate: "1997-08-01",
    hiredAt: "2024-10-14",
    leaveBalance: 12,
    phone: "+90 535 228 6674",
    email: "rumesh@cacaoroute.co",
    address: "Merdivenköy Mah. Ressam Salih Erimez Cad. 55/3, Kadıköy, İstanbul",
    role: "staff",
    template: [null, null, [10, 19], [16, 19], [9, 16], null, [13, 18]],
  },
  {
    id: "emp-task-cleaning",
    firstName: "Temizlik",
    lastName: "",
    positionTr: "Görev",
    positionEn: "Task",
    hourlyRate: 0,
    contract: "part",
    birthDate: null,
    hiredAt: null,
    leaveBalance: 0,
    phone: "",
    email: "",
    address: "",
    role: "staff",
    isTaskRow: true,
    displayNameEn: "Cleaning",
    template: [null, null, [6, 8], null, null, [6, 8], null],
  },
];

export const ADMIN_EMPLOYEE_ID = "emp-2";
export const DEMO_STAFF_EMPLOYEE_ID = "emp-4";
