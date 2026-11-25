export const LOCALES = ["en", "ur"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "en";

export const RTL_LOCALES: readonly AppLocale[] = ["ur"];

export function isRtlLocale(locale: string): boolean {
  return (RTL_LOCALES as readonly string[]).includes(locale);
}

export const CURRENCY_CODE = "PKR";

export const UserRole = {
  PASSENGER: "PASSENGER",
  COUNTER_AGENT: "COUNTER_AGENT",
  OPERATOR: "OPERATOR",
  CONDUCTOR: "CONDUCTOR",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ADMIN_PORTAL_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.OPERATOR,
  UserRole.COUNTER_AGENT,
  UserRole.CONDUCTOR,
];

export const OPS_ADMIN_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.OPERATOR,
];

export const ROLE_ALLOWED_PREFIXES: Record<UserRole, readonly string[]> = {
  [UserRole.PASSENGER]: [],
  [UserRole.COUNTER_AGENT]: ["/counter-pos", "/cancellations"],
  [UserRole.CONDUCTOR]: ["/gate-scanner"],
  [UserRole.OPERATOR]: [
    "/",
    "/fleet",
    "/routes",
    "/trips",
    "/counter-pos",
    "/gate-scanner",
    "/cancellations",
    "/promotions",
    "/reports",
  ],
  [UserRole.SUPER_ADMIN]: [
    "/",
    "/staff",
    "/fleet",
    "/routes",
    "/trips",
    "/counter-pos",
    "/gate-scanner",
    "/cancellations",
    "/promotions",
    "/reports",
  ],
};

export function canRoleAccessAdminPath(role: string | undefined | null, pathname: string): boolean {
  if (!role || !(role in ROLE_ALLOWED_PREFIXES)) return false;
  const typedRole = role as UserRole;
  const allowed = ROLE_ALLOWED_PREFIXES[typedRole];
  if (allowed.length === 0) return false;

  // Strip locale prefix (/en/... or /ur/...) if present
  const stripped = pathname.replace(/^\/(en|ur)(?=\/|$)/, "") || "/";

  if (stripped === "/") {
    return allowed.includes("/");
  }

  return allowed.some((prefix) => prefix !== "/" && (stripped === prefix || stripped.startsWith(`${prefix}/`)));
}

export function getDefaultRouteForRole(role: string | undefined | null): string {
  switch (role) {
    case UserRole.COUNTER_AGENT:
      return "/counter-pos";
    case UserRole.CONDUCTOR:
      return "/gate-scanner";
    case UserRole.OPERATOR:
    case UserRole.SUPER_ADMIN:
      return "/";
    default:
      return "/login";
  }
}

export const Gender = {
  MALE: "MALE",
  FEMALE: "FEMALE",
  OTHER: "OTHER",
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const BookingStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  PARTIALLY_CANCELLED: "PARTIALLY_CANCELLED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
  REFUNDED: "REFUNDED",
  NO_SHOW: "NO_SHOW",
  EXPIRED: "EXPIRED",
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const BookingSeatStatus = {
  LOCKED: "LOCKED",
  BOOKED: "BOOKED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
  NO_SHOW: "NO_SHOW",
} as const;
export type BookingSeatStatus = (typeof BookingSeatStatus)[keyof typeof BookingSeatStatus];

export const SeatType = {
  WINDOW: "WINDOW",
  AISLE: "AISLE",
  SLEEPER_LOWER: "SLEEPER_LOWER",
  SLEEPER_UPPER: "SLEEPER_UPPER",
} as const;
export type SeatType = (typeof SeatType)[keyof typeof SeatType];

export const BusType = {
  STANDARD_AC: "STANDARD_AC",
  EXECUTIVE: "EXECUTIVE",
  SLEEPER: "SLEEPER",
  LUXURY: "LUXURY",
} as const;
export type BusType = (typeof BusType)[keyof typeof BusType];

export const BusStatus = {
  ACTIVE: "ACTIVE",
  MAINTENANCE: "MAINTENANCE",
  RETIRED: "RETIRED",
} as const;
export type BusStatus = (typeof BusStatus)[keyof typeof BusStatus];

export const TripStatus = {
  SCHEDULED: "SCHEDULED",
  BOARDING: "BOARDING",
  DEPARTED: "DEPARTED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type TripStatus = (typeof TripStatus)[keyof typeof TripStatus];

export const PaymentMethod = {
  CASH_COUNTER: "CASH_COUNTER",
  CARD_ONLINE: "CARD_ONLINE",
  WALLET: "WALLET",
  STRIPE: "STRIPE",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentStatus = {
  INITIATED: "INITIATED",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const TicketStatus = {
  ISSUED: "ISSUED",
  BOARDED: "BOARDED",
  CANCELLED: "CANCELLED",
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const MAX_SEATS_PER_BOOKING = 6;
export const SEAT_LOCK_DURATION_SECONDS = 600;
