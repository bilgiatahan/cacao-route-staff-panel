import {
  Banknote,
  Bell,
  Briefcase,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Globe,
  Headset,
  Hourglass,
  House,
  Inbox,
  Info,
  LoaderCircle,
  RefreshCw,
  SearchX,
  TriangleAlert,
  Lock,
  LogOut,
  Mail,
  Menu,
  Plus,
  Save,
  ShieldCheck,
  Scale,
  SlidersHorizontal,
  Smartphone,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Wallet,
  type IconNode,
} from "lucide";

import { cn } from "@/lib/utils";

/**
 * Every glyph in the panel, named for what it means here rather than for what
 * Lucide calls it: call sites ask for `pay` or `timetable`, so swapping the
 * drawing behind a name — or the library behind all of them — stays a one-line
 * change in this file.
 *
 * The drawings come from `lucide`, the framework-agnostic data package, rather
 * than from `lucide-react`: since v1 every `lucide-react` component carries a
 * `"use client"` directive, which would turn each of these glyphs into its own
 * client boundary. These are plain `[tag, attrs]` arrays, so `Icon` below stays
 * a server component and no icon code reaches the browser.
 */
const ICONS = {
  summary: ChartColumn,
  timetable: CalendarDays,
  // The leave tab and the sign-out row were the same door-and-arrow drawing
  // before Lucide, and still are.
  leave: LogOut,
  signOut: LogOut,
  team: Users,
  // `pay` is the rate itself (a banknote); `wallet` is money earned.
  pay: Banknote,
  wallet: Wallet,
  notifications: Bell,
  menu: Menu,
  plus: Plus,
  chevronRight: ChevronRight,
  chevronLeft: ChevronLeft,
  user: User,
  briefcase: Briefcase,
  // Sliders rather than a gear: a cog reads as mush at 18px in this stroke.
  settings: SlidersHorizontal,
  support: Headset,
  shield: ShieldCheck,
  globe: Globe,
  clock: Clock,
  calendarCheck: CalendarCheck,
  calendarClock: CalendarClock,
  inbox: Inbox,
  hourglass: Hourglass,
  home: House,
  lock: Lock,
  phone: Smartphone,
  mail: Mail,
  document: FileText,
  save: Save,
  info: Info,
  alert: TriangleAlert,
  spinner: LoaderCircle,
  retry: RefreshCw,
  notFound: SearchX,
  // Reporting: a rising or falling figure, and the blended-rate scale.
  trendUp: TrendingUp,
  trendDown: TrendingDown,
  rate: Scale,
} as const satisfies Record<string, IconNode>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  className?: string;
}

/**
 * Lucide draws at a 2px stroke with round caps and joins. The panel is drawn
 * with square caps and mitred joins — the same geometry as the rules and badges
 * around the icons — so the whole set is restyled here, in one place.
 */
export function Icon({ name, className }: IconProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={cn("h-[18px] w-[18px] flex-none", className)}
    >
      {ICONS[name].map(([Tag, attrs], index) => (
        <Tag key={index} {...attrs} />
      ))}
    </svg>
  );
}
