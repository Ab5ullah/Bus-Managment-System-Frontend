# Frontend & Admin Dashboard Implementation Plan
**Stack:** Next.js (App Router) · React · TypeScript · Tailwind CSS · shadcn/ui · TanStack Query · `openapi-typescript` / `orval` · React Hook Form + Zod · `next-intl` (EN / UR + RTL)

---

## 1. Architecture & Monorepo Strategy

Both web clients share React, TypeScript, validation schemas, UI primitives, and a single generated OpenAPI client derived directly from the Django backend's `drf-spectacular` schema (`/api/schema/`).

```text
busms-frontend/ (pnpm + Turborepo)
├── apps/
│   ├── web/                  # Public Passenger Website (www.yourdomain.pk) — SSR + SEO + Booking Flow
│   └── admin/                # Operations & Admin Dashboard (admin.yourdomain.pk) — RBAC Ops Portal
└── packages/
    ├── api-client/           # OpenAPI-generated TypeScript types & typed fetchers (/api/schema/)
    ├── ui/                   # Shared shadcn/ui components, SeatMap grid, currency/status badges
    └── config/               # Shared ESLint, Tailwind preset, Zod schemas, i18n keys
```

### API & Backend Alignment Notes (Current State vs. Target)
1. **Current Live Endpoints:** The Django backend currently exposes routes under `/api/` (e.g. `/api/auth/`, `/api/search/`, `/api/bookings/`, `/api/payments/`, `/api/tickets/`, `/api/cancellations/`, `/api/promotions/`, `/api/admin/reports/`, and `/api/schema/`).
2. **Optional Backend Prep (Phase F0):** Before generating clients, decide whether to mount `/api/v1/` alongside `/api/` in `config/urls.py` and expose a lightweight `/api/app-config/` endpoint (currency, tax rate, service fee, support contact, active feature flags, Stripe publishable key) so Next.js, Admin, and Flutter stay synchronized.
3. **Rule Authority:** Never duplicate fare, tax (`5%`), service fee (`50 PKR`), coupon discount, refund tier math, or seat availability on the frontend. All financial & inventory numbers come strictly from the Django API.

---

## 2. Technology Stack & Conventions

| Layer | Selection | Implementation Details |
| :--- | :--- | :--- |
| **Framework** | Next.js (App Router, TS) | SSR/ISR Server Components for SEO pages; `'use client'` interactive islands for booking & admin consoles |
| **Styling & UI** | Tailwind CSS + `shadcn/ui` | Dark/light theme tokens, accessible dialogs, tables, drawers, date pickers, toast notifications |
| **Server State** | TanStack Query v5 | Caching, background refetching, polling (`refetchInterval`) for Stripe payment confirmation & conductor manifests |
| **Typed API Client** | `openapi-typescript` + `openapi-fetch` (or `orval`) | Generated directly from `GET /api/schema/` so backend serializer changes fail frontend `tsc` at build time |
| **Forms & Validation** | React Hook Form + Zod | Shared client-side form schemas matching DRF request payloads |
| **Internationalization** | `next-intl` | Locale routing (`/en/...`, `/ur/...`), automatic `<html dir="rtl">` & RTL Tailwind logical properties (`ms-`, `me-`, `ps-`, `pe-`) for Urdu |
| **Authentication (BFF)** | Next.js Route Handlers + JWT | Login/refresh Route Handlers set `refresh_token` in an `httpOnly`, `Secure`, `SameSite=Lax` cookie; `access_token` stays in memory (React context) |
| **Seat Map** | Custom CSS-Grid / SVG | Driven strictly by `/api/search/trips/{trip_id}/seat-map/` (`row`, `column`, `deck`, `seat_type`, `is_ladies_only`, `status`) |
| **Observability** | Sentry + Plausible / GA4 | Client/server error tracking + funnel conversion events (Search → Lock → Checkout → Paid) |
| **Hosting** | Self-hosted Node + Nginx (or Vercel) | CORS locked down in Django `CORS_ALLOWED_ORIGINS` strictly to `www.yourdomain.pk` & `admin.yourdomain.pk` |

---

## 3. Authentication & Security Flow (`httpOnly` Cookie BFF Pattern)

To avoid exposing long-lived refresh tokens in `localStorage` (XSS risk):

1. **Login (`POST /api/auth/login/` via Next.js `/api/session/login`):**
   - Next.js Route Handler forwards credentials to Django `POST /api/auth/login/`.
   - Stores `refresh` token in an `httpOnly; Secure; SameSite=Lax` cookie.
   - Returns `{ access, user }` to the browser, stored **in memory only**.
2. **Silent Refresh (`POST /api/session/refresh`):**
   - On page reload or `401 Unauthorized`, Next.js Route Handler reads the `httpOnly` refresh cookie, calls Django `POST /api/auth/refresh/`, rotates the cookie, and returns a fresh in-memory `access` token.
3. **Logout (`POST /api/session/logout`):**
   - Calls Django `POST /api/auth/logout/` (blacklisting the refresh token) and clears the cookie.
4. **Admin Route Guard (`apps/admin/middleware.ts`):**
   - Verifies session presence and enforces RBAC roles (`OPERATOR`, `SUPER_ADMIN`, `COUNTER_AGENT`, `CONDUCTOR`) per dashboard section.

---

## 4. Implementation Phases

### Phase F0: Monorepo Scaffold, OpenAPI Client & i18n Foundation
* **Deliverables:**
  - Initialize `pnpm` + Turborepo workspace (`apps/web`, `apps/admin`, `packages/api-client`, `packages/ui`).
  - *(Optional backend prep)* Add `/api/v1/` prefix alias & `/api/app-config/` endpoint in Django.
  - Configure `openapi-typescript` codegen script pointing at `http://127.0.0.1:8000/api/schema/`.
  - Configure Tailwind CSS, `shadcn/ui`, TanStack Query provider, and `next-intl` (`en` LTR + `ur` RTL).
  - Build Next.js BFF Route Handlers for JWT `httpOnly` cookie auth + `fetch` auto-refresh interceptor.

---

### Phase F1: Public Passenger Website — SEO & Discovery (`apps/web`)
* **Server-Rendered Pages (App Router + ISR/Metadata API):**
  - `/` **Home Page:** Hero route search widget (Origin terminal, Destination terminal, Travel date), popular corridors powered by `GET /api/search/popular/`, fleet classes, trust highlights.
  - `/routes/[slug]` **SEO Route Landing Pages:** Dynamic metadata (`"Lahore to Islamabad Bus Tickets — Timings & Fares"`), terminal details, distance/duration, live upcoming departures.
  - `/terminals`, `/faq`, `/terms`, `/contact` **Static/CMS Info Pages** (localized in English & Urdu).
  - `/search` **Trip Results Page:** Reads `?origin=&destination=&date=&bus_type=`, queries `GET /api/search/trips/`, filters by Bus Type (`STANDARD_AC`, `EXECUTIVE`, `SLEEPER`, `LUXURY`), departure window, and live fare (already reflecting Dynamic Pricing rules).

---

### Phase F2: Interactive Seat Selection, Lock Countdown & Checkout (`apps/web`)
* **Components (`packages/ui` + `apps/web`):**
  - **`<SeatMap />` Component:** Renders deck tabs (Upper/Lower for sleepers, single deck 2x2/2x1), aisle gaps, driver badge, and color-coded seat states:
    - Available (`emerald`), Ladies-Only (`fuchsia`), Occupied/Locked (`slate` disabled), Selected (`indigo`).
    - Enforces max 6 seats per selection client-side to match backend lock rules.
  - **Hold & Countdown Flow:**
    - Clicking "Continue" calls `POST /api/bookings/lock-seats/`, stores `lock_token` + `expires_at`, and starts a live **10:00 countdown timer**.
    - Leaving/cancelling calls `POST /api/bookings/unlock-seats/`.
  - **Passenger Details & Promo Checkout:**
    - React Hook Form + Zod for per-seat passenger name, gender (`MALE`/`FEMALE`/`OTHER` — pre-validating against `is_ladies_only`), age, and contact details.
    - Coupon input box calling `POST /api/promotions/validate-coupon/` for live discount/tax preview.
    - Submit calls `POST /api/bookings/create/` (passing `lock_token` and optional `coupon_code`) to create the `PENDING` PNR.

---

### Phase F3: Payments (Stripe Hosted Checkout) & Status Polling (`apps/web`)
* **Checkout Initiation:**
  - Calls `POST /api/payments/initiate/` (`gateway_name: "stripe"`, `return_url: "<origin>/checkout/return"`).
  - Redirects passenger to Stripe's returned `checkout_url`.
* **Return & Webhook-Authoritative Confirmation (`/checkout/return`):**
  - Reads `?payment_status=success&pnr=...&session_id=...`.
  - Calls `POST /api/payments/verify-stripe-session/` and polls `GET /api/bookings/{pnr}/` via TanStack Query (`refetchInterval: 2000`) until `booking.status === 'CONFIRMED'` (ensuring the webhook-captured state is reflected cleanly).
  - Displays confirmation screen with PNR, itemized receipt (`GET /api/payments/receipt/{receipt_number}/`), QR boarding pass preview, and **Download PDF Pass** (`GET /api/tickets/{ticket_number}/pdf/`).

---

### Phase F4: Passenger Account Portal & Self-Service Cancellations (`apps/web`)
* **Auth Pages:** `/login`, `/register`, `/verify-otp`, `/forgot-password` wired to `/api/auth/...`.
* **Account Area (`/account/...`):**
  - **My Bookings:** List via `GET /api/bookings/` + PNR quick lookup.
  - **Ticket & QR Viewer:** Displays e-tickets (`GET /api/tickets/booking/{pnr}/`) with scannable QR code and PDF download button.
  - **Saved Passengers:** Full CRUD via `/api/accounts/saved-passengers/` for 1-click checkout autofill.
  - **Self-Service Cancellation Drawer:**
    - Calls `POST /api/cancellations/estimate/` to preview applicable policy tier (`>24h: 90%`, `6-24h: 50%`, `<6h: 0%`), non-refundable service fee, and exact net refund.
    - Supports **Partial Seat Cancellation** (`POST /api/cancellations/cancel-seats/`) via seat checkboxes or **Full Booking Cancellation** (`POST /api/cancellations/cancel-booking/`).
    - Shows refund audit history (`GET /api/cancellations/refunds/{pnr}/`).

---

### Phase F5: Operations & Admin Dashboard — Core Fleet, Routes & Trips (`apps/admin`)
*Role Scope: `OPERATOR`, `SUPER_ADMIN`*

1. **Dashboard Overview:** Live KPI tiles pulled from `/api/admin/reports/revenue/`, `occupancy/`, `route-performance/`, and `agent-sales/`.
2. **Fleet & Seat Layout Studio (`/fleet`):**
   - Bus CRUD + visual seat matrix preview (`2x2`, `2x1`, `SLEEPER`, Ladies-only rows) via `/api/fleet/buses/`.
   - Driver & Conductor directory management (`/api/fleet/drivers/`, `/api/fleet/conductors/`).
3. **Terminals & Corridor Builder (`/routes`):**
   - Terminal CRUD with city/GPS coordinates (`/api/routes/terminals/`).
   - Visual ordered route-stop timeline editor (distance km & offset minutes per stop) via `/api/routes/`.
4. **Trip Scheduler & Fare Matrix (`/trips`):**
   - Trip creation with overlap conflict feedback (bus/driver/conductor double-booking protection).
   - Segment fare rule matrix editor (stop-to-stop & seat-type overrides) + per-trip seat blocking (`TripSeatBlock`).

---

### Phase F6: Operations — Counter POS, Conductor Gate Scanner & Emergency Ops (`apps/admin`)
*Role Scope: `COUNTER_AGENT`, `CONDUCTOR`, `OPERATOR`, `SUPER_ADMIN`*

1. **Counter Walk-In POS (`/counter-pos`):**
   - Fast trip/segment search → interactive seat map → walk-in passenger entry → instant `CONFIRMED` booking (`POST /api/bookings/counter/`) + immediate thermal/PDF pass print.
2. **Conductor Gate Scanner & Live Manifest (`/gate-scanner`):**
   - Trip selector loading `GET /api/tickets/manifest/{trip_id}/` with live capacity, boarded count, pending count, and occupancy %.
   - Camera QR scanner (e.g. `html5-qrcode`) or manual ticket lookup calling `POST /api/tickets/validate-qr/` (displaying `CLEARED FOR BOARDING` or tamper/already-boarded alerts) and `POST /api/tickets/board/`.
3. **Refunds & Emergency Trip Override (`/cancellations`):**
   - Lookup any PNR, inspect refund breakdown, execute customer/counter cancellations.
   - **Operator Emergency Trip Cancel Modal:** Triggers `POST /api/cancellations/operator/cancel-trip/` issuing 100% bulk refunds.

---

### Phase F7: Promotions, Dynamic Yield Pricing & BI Reports (`apps/admin`)
*Role Scope: `OPERATOR`, `SUPER_ADMIN`*

1. **Promotions & Yield Studio (`/promotions`):**
   - Coupon Campaign CRUD (`/api/admin/promotions/coupons/`) with live usage quota progress bars (`current_usage_count / max_total_uses`).
   - Dynamic Pricing Rules CRUD (`/api/admin/promotions/dynamic-rules/`) for `SURGE_OCCUPANCY`, `EARLY_BIRD`, `LAST_MINUTE`, and `WEEKEND` multipliers.
2. **Business Intelligence & Exports (`/reports`):**
   - Interactive charts (Recharts or Tremor) for Daily/Weekly/Monthly **Gross vs. Refund vs. Net Revenue**, **Load Factor (`Passenger-km / Seat-km`)**, **Top Routes & Peak Travel Hours**, and **Counter Agent 5% Commission Payouts**.
   - Direct authenticated download buttons for **CSV** and **Excel (`.xlsx`)** via `/api/admin/reports/export/?type=...&format=csv|xlsx`.

---

### Phase F8: Hardening, Testing & Deployment
1. **Testing:**
   - **Unit & Component Tests:** Vitest + React Testing Library (`<SeatMap />`, countdown timer, refund estimator preview, RTL layout).
   - **End-to-End Tests:** Playwright flow covering Search → Seat Lock → Coupon Apply → Stripe Test Checkout → Return Verification → PDF Ticket Link → Partial Seat Cancellation.
2. **Security & Performance:**
   - Enable Next.js Image Optimization, strict CSP headers, and configure Django `CORS_ALLOWED_ORIGINS` for `www.yourdomain.pk` & `admin.yourdomain.pk`.
   - Confirm `next-intl` English (`LTR`) and Urdu (`RTL`) visual regression passes across booking & admin tables.
3. **Deployment:**
   - Production `Dockerfile` (multi-stage standalone Next.js build) behind Nginx reverse proxy alongside Django + Gunicorn + Postgres + Redis.
