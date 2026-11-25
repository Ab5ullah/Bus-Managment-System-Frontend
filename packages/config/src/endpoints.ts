/**
 * Centralized API & BFF endpoint constants for all SafarLine (BUSMS) clients.
 * Dynamic paths use typed helper functions with URL-safe encoding.
 */
export const API_ENDPOINTS = {
  BFF: {
    LOGIN: "/api/session/login",
    LOGOUT: "/api/session/logout",
    REFRESH: "/api/session/refresh",
  },
  AUTH: {
    REGISTER: "/api/auth/register/",
    VERIFY_OTP: "/api/auth/verify-otp/",
    LOGIN: "/api/auth/login/",
    REFRESH: "/api/auth/refresh/",
    LOGOUT: "/api/auth/logout/",
    PASSWORD_RESET_REQUEST: "/api/auth/password-reset-request/",
    PASSWORD_RESET_CONFIRM: "/api/auth/password-reset-confirm/",
  },
  ACCOUNTS: {
    PROFILE: "/api/accounts/profile/",
    SAVED_PASSENGERS: "/api/accounts/saved-passengers/",
    savedPassengerDetail: (id: string) =>
      `/api/accounts/saved-passengers/${encodeURIComponent(id)}/`,
  },
  SEARCH: {
    POPULAR: "/api/search/popular/",
    TRIPS: "/api/search/trips/",
    seatMap: (tripId: string) =>
      `/api/search/trips/${encodeURIComponent(tripId)}/seat-map/`,
  },
  ROUTES: {
    TERMINALS: "/api/routes/terminals/",
    terminalDetail: (id: string) =>
      `/api/routes/terminals/${encodeURIComponent(id)}/`,
    LIST: "/api/routes/",
    detail: (id: string) => `/api/routes/${encodeURIComponent(id)}/`,
    updateStops: (id: string) =>
      `/api/routes/${encodeURIComponent(id)}/update-stops/`,
  },
  FLEET: {
    BUSES: "/api/fleet/buses/",
    busDetail: (id: string) => `/api/fleet/buses/${encodeURIComponent(id)}/`,
    generateSeats: (busId: string) =>
      `/api/fleet/buses/${encodeURIComponent(busId)}/generate-seats/`,
    busSeatDetail: (busId: string, seatId: string) =>
      `/api/fleet/buses/${encodeURIComponent(busId)}/seats/${encodeURIComponent(seatId)}/`,
    DRIVERS: "/api/fleet/drivers/",
    driverDetail: (id: string) =>
      `/api/fleet/drivers/${encodeURIComponent(id)}/`,
    CONDUCTORS: "/api/fleet/conductors/",
    conductorDetail: (id: string) =>
      `/api/fleet/conductors/${encodeURIComponent(id)}/`,
  },
  TRIPS: {
    LIST: "/api/trips/",
    detail: (id: string) => `/api/trips/${encodeURIComponent(id)}/`,
    seats: (id: string) => `/api/trips/${encodeURIComponent(id)}/seats/`,
    blockSeat: (id: string) =>
      `/api/trips/${encodeURIComponent(id)}/block-seat/`,
    unblockSeat: (id: string, seatId: string) =>
      `/api/trips/${encodeURIComponent(id)}/unblock-seat/${encodeURIComponent(seatId)}/`,
    FARE_RULES: "/api/trips/fare-rules/",
    fareRuleDetail: (id: string) =>
      `/api/trips/fare-rules/${encodeURIComponent(id)}/`,
  },
  BOOKINGS: {
    LIST: "/api/bookings/",
    detail: (pnr: string) => `/api/bookings/${encodeURIComponent(pnr)}/`,
    LOCK_SEATS: "/api/bookings/lock-seats/",
    UNLOCK_SEATS: "/api/bookings/unlock-seats/",
    CREATE: "/api/bookings/create/",
    COUNTER: "/api/bookings/counter/",
  },
  PAYMENTS: {
    INITIATE: "/api/payments/initiate/",
    CONFIRM_MOCK: "/api/payments/confirm-mock/",
    VERIFY_STRIPE_SESSION: "/api/payments/verify-stripe-session/",
    byBooking: (pnr: string) =>
      `/api/payments/booking/${encodeURIComponent(pnr)}/`,
    receipt: (receiptNumber: string) =>
      `/api/payments/receipt/${encodeURIComponent(receiptNumber)}/`,
    receiptPdf: (receiptNumber: string) =>
      `/api/payments/receipt/${encodeURIComponent(receiptNumber)}/pdf/`,
  },
  TICKETS: {
    byBooking: (pnr: string) =>
      `/api/tickets/booking/${encodeURIComponent(pnr)}/`,
    detail: (ticketNumber: string) =>
      `/api/tickets/${encodeURIComponent(ticketNumber)}/`,
    pdf: (ticketNumber: string) =>
      `/api/tickets/${encodeURIComponent(ticketNumber)}/pdf/`,
    VALIDATE_QR: "/api/tickets/validate-qr/",
    BOARD: "/api/tickets/board/",
    manifest: (tripId: string) =>
      `/api/tickets/manifest/${encodeURIComponent(tripId)}/`,
  },
  CANCELLATIONS: {
    POLICIES: "/api/cancellations/policies/",
    ESTIMATE: "/api/cancellations/estimate/",
    CANCEL_BOOKING: "/api/cancellations/cancel-booking/",
    CANCEL_SEATS: "/api/cancellations/cancel-seats/",
    refunds: (pnr: string) =>
      `/api/cancellations/refunds/${encodeURIComponent(pnr)}/`,
    OPERATOR_CANCEL_TRIP: "/api/cancellations/operator/cancel-trip/",
  },
  PROMOTIONS: {
    VALIDATE_COUPON: "/api/promotions/validate-coupon/",
    ADMIN_COUPONS: "/api/promotions/admin/coupons/",
    adminCouponDetail: (id: string) =>
      `/api/promotions/admin/coupons/${encodeURIComponent(id)}/`,
    ADMIN_DYNAMIC_RULES: "/api/promotions/admin/dynamic-rules/",
    adminDynamicRuleDetail: (id: string) =>
      `/api/promotions/admin/dynamic-rules/${encodeURIComponent(id)}/`,
  },
  ADMIN_REPORTS: {
    REVENUE: "/api/admin/reports/revenue/",
    OCCUPANCY: "/api/admin/reports/occupancy/",
    ROUTE_PERFORMANCE: "/api/admin/reports/route-performance/",
    AGENT_SALES: "/api/admin/reports/agent-sales/",
    EXPORT: "/api/admin/reports/export/",
  },
} as const;
