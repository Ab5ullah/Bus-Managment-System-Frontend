# SafarLine (BUSMS) — Website Design & Flutter Passenger App Blueprint

This document captures the exact visual design system, user flows, component rules, state architecture, and API contracts of the **SafarLine Passenger Web App** (`apps/web`) so you can build a matching **Flutter mobile app** for passengers to search, select seats, pay, and manage tickets.

---

## 1. Visual Design System & Flutter Theme Tokens

The web app uses a clean, high-contrast transit aesthetic built around deep teal-emerald (`#0E7166`), crisp slate neutrals, `8px` (`0.5rem`) base corner radius, and tabular numerals for all fares, seat numbers, and countdown timers.

### 1.1 Color Palette (Light & Dark Modes)

Converted directly from `packages/ui/src/styles/globals.css`:

| Semantic Token | Light Mode (HSL → Hex) | Dark Mode (HSL → Hex) | Flutter `ColorScheme` / Usage |
|---|---|---|---|
| `background` | `210 20% 98%` (`#F8FAFC`) | `222 36% 7%` (`#0B101B`) | `scaffoldBackgroundColor` |
| `foreground` | `222 47% 11%` (`#0F172A`) | `210 40% 96%` (`#F1F5F9`) | Primary body & heading text |
| `card` | `0 0% 100%` (`#FFFFFF`) | `222 32% 10%` (`#111827`) | `cardColor` / surface panels |
| `primary` | `173 78% 25%` (`#0E7166`) | `171 68% 38%` (`#1FA391`) | Primary CTAs, active tabs, selected gender pill |
| `primaryForeground` | `0 0% 100%` (`#FFFFFF`) | `222 47% 8%` (`#0B111E`) | Text/icons on primary buttons |
| `secondary` | `214 25% 94%` (`#ECF0F5`) | `217 26% 16%` (`#1E2736`) | Secondary chips & subtle fills |
| `muted` | `214 20% 95%` (`#EFF2F6`) | `217 26% 15%` (`#1C2432`) | Input backgrounds, skeleton loaders |
| `mutedForeground` | `215 16% 42%` (`#5A677B`) | `215 18% 64%` (`#94A3B8`) | Subtitles, labels, timestamps |
| `border` | `214 22% 88%` (`#DCE2EA`) | `217 24% 18%` (`#232D3F`) | `1px` card & divider borders |
| `destructive` / `danger` | `348 80% 48%` (`#DC1840`) | `348 74% 56%` (`#E33B5D`) | Errors, cancel actions |
| `statusSuccess` | `158 72% 32%` (`#178C61`) | `158 64% 46%` (`#2AC089`) | Confirmed badges, valid QR, refunds |
| `statusWarning` | `32 95% 44%` (`#DC7A05`) | `38 92% 54%` (`#F5A623`) | Pending payment, expiring hold timer |
| `statusInfo` | `221 76% 48%` (`#1D5BD6`) | `217 88% 62%` (`#4B8AF4`) | Scheduled trips, issued tickets |
| **Ladies / Female-Only** | Fuchsia `#D946EF` / `#FDF4FF` | Fuchsia `#A21CAF` / `#4A044E` | Ladies-only & female-adjacent seats |
| **Selected Seat** | Indigo `#4F46E5` (border `#4338CA`) | Indigo `#4F46E5` | Currently selected seats on cabin map |
| **Available Seat** | Emerald `#10B981` / `#ECFDF5` | Emerald `#065F46` | Open seats |

### 1.2 Typography & Shapes

- **Primary Font (`sans`):** `Plus Jakarta Sans` (`google_fonts: PlusJakartaSans`)
- **Monospace Font (`mono`):** `JetBrains Mono` (`google_fonts: JetBrainsMono`) — used for PNRs (`PKN567FN`), seat numbers (`1A`), ticket numbers, countdowns (`09:45`), and prices.
- **Numeric Alignment:** Always apply `fontFeatures: [FontFeature.tabularFigures()]` on fares (`PKR 2,500`), times (`09:00`), and timers.
- **Border Radius:** Base `--radius` = `8.0` (`BorderRadius.circular(8)` for inputs/buttons, `12.0` for cards, `16.0` for the coach cabin container).
- **Internationalization & RTL:** Supports English (`en`, LTR) and Urdu (`ur`, RTL). Use `Directionality` / `EdgeInsetsDirectional` (`start`/`end` instead of `left`/`right`) so Urdu switches cleanly.

---

## 2. Recommended Flutter Stack

| Responsibility | Package | Notes |
|---|---|---|
| State Management & API Caching | `flutter_riverpod` (`AsyncNotifier` / `FutureProvider`) | Mirrors TanStack Query's caching & invalidation for live seat maps |
| HTTP Client & Auth Interceptor | `dio` | Attach `Authorization: Bearer <access>`, auto-refresh on `401` via `/api/auth/refresh/` |
| Navigation & Deep Links | `go_router` | Handles `/checkout/return` deep link after Stripe Checkout |
| Models & Validation | `freezed` + `json_serializable` | Typed DTOs matching Django DRF responses |
| Secure Token Storage | `flutter_secure_storage` | Store JWT `access` and `refresh` tokens |
| QR Boarding Pass | `qr_flutter` + `image` (or render `qr_code_base64` directly via `Image.memory`) | Backend already returns `qr_code_base64` on tickets |
| Stripe Checkout / PDF | `url_launcher` (in-app browser) or `flutter_stripe` | Open Stripe `checkout_url` and `/api/tickets/{ticket_number}/pdf/` |
| Localization | `flutter_localizations` + `intl` | `en` (LTR) & `ur` (RTL) |

---

## 3. Screen Map & Navigation Architecture

### Bottom Navigation / Primary Tabs
1. **Home / Search** (`/`) — Hero search card + popular corridors + trust highlights
2. **Routes & Terminals** (`/routes`, `/terminals`) — Browse active corridors and terminal directory
3. **My Bookings** (`/account`) — Upcoming/past/pending/cancelled bookings, quick PNR lookup, saved companions, profile
4. **Help / More** (`/faq`, `/contact`, `/terms`) — Refund policy summary, support contact

### Full Screen Flow
1. **HomeScreen** → Origin, Destination, Date (optional), Bus Class (optional) → **SearchResultsScreen**
2. **SearchResultsScreen** → Filters (bus type, departure window, max price, sort) + Pagination → Tap **Select Seats** → **SeatSelectionScreen**
3. **SeatSelectionScreen (Step 1)** → Gender toggle (`Male` / `Female` / `Other`) + Interactive Coach `SeatMap` → Tap **Hold Seats (10 min)** (`POST /api/bookings/lock-seats/`)
4. **PassengerDetailsScreen (Step 2)** → Live 10-minute `LockCountdown` banner + Primary Contact + Per-seat passenger assignment (with Saved Companions autofill) + Promo Coupon validator → Tap **Confirm & Proceed to Payment** (`POST /api/bookings/create/`)
5. **CheckoutPaymentScreen (Step 3)** → Itemized fare summary + **Pay with Stripe** (`POST /api/payments/initiate/`) → Redirects to Stripe Checkout (or Sandbox Confirm in dev)
6. **CheckoutReturnScreen** → Polls booking status until `CONFIRMED`, displays Official Receipt + QR Boarding Passes + **Download PDF Pass**
7. **Auth Screens** → `LoginScreen`, `RegisterScreen`, `VerifyOtpScreen` (6-digit OTP), `ForgotPasswordScreen` (2-step request + confirm)

---

## 4. Core Screen & Component Specifications

### 4.1 Search Results & Filters
- **Endpoint:** `GET /api/search/trips/`
- **Query Params:**
  - `origin` / `origin_terminal` (city name, terminal code like `LHR-BUS`, terminal name, or UUID)
  - `destination` / `destination_terminal`
  - `date` (`YYYY-MM-DD`, optional — omit for all upcoming departures)
  - `bus_type`: `STANDARD_AC` | `EXECUTIVE` | `LUXURY` | `SLEEPER`
  - `departure_window`: `morning` (`05:00–11:59`) | `afternoon` (`12:00–17:59`) | `night` (`18:00–04:59`)
  - `max_price`: decimal string
  - `sort_by`: `departure_asc` | `departure_desc` | `price_asc` | `price_desc` | `duration_asc`
  - `page`, `page_size`
- **Trip Card UI:**
  - Left: Departure time (`09:00`, bold mono) + Origin City → Duration (`4h 20m`) → Arrival time (`13:20`) + Destination City
  - Meta: Coach Class badge (`STANDARD_AC`), Bus Reg (`LEA-6213`), Seats left (`37 seats left` or `Sold Out`)
  - Right: Fare in `PKR` (`tabular-nums`, primary teal) + **Select Seats** button
  - On tap: pass `trip_id`, `segment_details.from_stop_id`, and `segment_details.to_stop_id` to **SeatSelectionScreen**.

### 4.2 Interactive Seat Map & Dynamic Gender Guard (`SeatMap`)
- **Endpoint:** `GET /api/search/trips/{trip_id}/seat-map/?from_stop={from_stop_id}&to_stop={to_stop_id}`
- **Seat Item Fields:**
  ```json
  {
    "id": "seat-uuid",
    "seat_number": "1B",
    "row": 1,
    "column": 2,
    "deck": 1,
    "seat_type": "AISLE",
    "is_ladies_only": false,
    "status": "AVAILABLE",
    "fare": "2500.00",
    "is_available": true,
    "occupied_gender": null,
    "female_adjacent_restricted": true,
    "allowed_genders": ["FEMALE"]
  }
  ```
- **Grid & Aisle Rules:**
  - Group seats by `deck` (`1` = Lower Deck, `2` = Upper Deck; show deck tabs only if `decks.length > 1`).
  - Render rows sorted ascending; insert an aisle spacer after column `2` for 3/4-column layouts (`2x2` or `2x1`), or after column `1` for 2-column sleepers.
  - Top of cabin: `"Front Entrance"` label on start, `"Driver"` steering wheel badge on end.
- **Dynamic Gender Selection Rules:**
  - Show a **"Selecting seats for: [Male | Female | Other]"** segmented control above the seat map.
  - **Max seats per booking:** `6` (`MAX_SEATS_PER_BOOKING = 6`).
  - **5 Visual States per Seat:**
    1. **Selected:** Indigo fill (`#4F46E5`), white text.
    2. **Available (Open):** Emerald outline & soft tint (`#ECFDF5`).
    3. **Female-Only / Adjacent Restricted** (`is_ladies_only == true` OR `female_adjacent_restricted == true` OR `allowed_genders` excludes `"MALE"`): Fuchsia outline & tint.
       - If `activeGender != "FEMALE"`, disable tap and dim opacity (`0.7`) with tooltip *"Female-Only (adjacent to female passenger)"*.
    4. **Occupied / Locked** (`status == "BOOKED" | "LOCKED"`): Disabled slate fill. If `occupied_gender == "FEMALE"`, use a subtle fuchsia tint and show `"F"` (or `"M"` / `"O"` for other genders).
    5. **Blocked** (`status == "BLOCKED"`): Disabled slate fill with ban icon.
  - In the **Selected Seats** bottom sheet / summary, allow changing each selected seat's gender individually (`Male` / `Female` / `Other`), locking the dropdown to `Female` if `is_ladies_only || female_adjacent_restricted`.

### 4.3 Seat Lock & 10-Minute Hold Countdown
- **Lock Request:** `POST /api/bookings/lock-seats/`
  ```json
  {
    "trip_id": "...",
    "from_stop": "...",
    "to_stop": "...",
    "seat_ids": ["seat-1a-uuid"],
    "seat_genders": { "seat-1a-uuid": "FEMALE" },
    "lock_duration_minutes": 10
  }
  ```
- **Response:**
  ```json
  {
    "lock_token": "uuid",
    "locked_until": "2026-11-26T12:45:00Z",
    "expires_in_seconds": 600,
    "locked_seats": [
      {
        "seat_id": "seat-1a-uuid",
        "seat_number": "1A",
        "deck": 1,
        "row": 1,
        "column": 1,
        "seat_type": "WINDOW",
        "is_ladies_only": false,
        "fare": "2500.00"
      }
    ]
  }
  ```
- **Countdown Behavior:**
  - Tick every 1 second comparing `locked_until` against `DateTime.now()`.
  - Format `MM:SS` in monospace; switch badge to warning/danger color when `< 120s`.
  - When `00:00` is reached, clear lock state, show `"Your 10-minute seat hold expired"`, and return to seat selection.
  - **Change Seats** button calls `POST /api/bookings/unlock-seats/` with `{ "lock_token": "..." }` and refreshes the seat map.

### 4.4 Passenger Form, Validation & Coupon Preview
- **Primary Contact:**
  - `passenger_name` (min 2 chars)
  - `passenger_phone` (valid phone regex `^[+]?[\d\s-]{10,20}$`, e.g. `+923001234567`)
  - `passenger_email` (optional)
- **Per-Seat Passenger Assignment:**
  - `passenger_name` (required, min 2 chars)
  - `gender`: `MALE` | `FEMALE` | `OTHER` (locked to `FEMALE` if seat is female-restricted)
  - `age`: optional integer `1..120`
  - `cnic_or_id`: Pakistani 13-digit CNIC (`35202-1234567-1` or `3520212345671`) or Passport ID (`6–20` alphanumeric with at least 1 digit). Regex:
    `^(\d{5}-\d{7}-\d|\d{13}|(?=.*\d)[A-Za-z0-9]{6,20})$`
  - **Saved Companions Autofill (when signed in):** Dropdown from `GET /api/accounts/saved-passengers/` to autofill name, gender, age, and CNIC in 1 tap.
- **Promo / Coupon Validation:**
  - `POST /api/promotions/validate-coupon/` with `{ "code": "EID20", "gross_amount": "2500.00", "passenger_phone": "+923001234567" }`
  - Returns `discount_amount`, `projected_tax_amount`, `projected_service_fee`, `projected_net_payable`.

### 4.5 Create Booking & Payment Checkout
1. **Create PNR Reservation:** `POST /api/bookings/create/`
   - Payload: `trip_id`, `lock_token`, `from_stop`, `to_stop`, `passenger_name`, `passenger_phone`, `passenger_email`, `payment_method: "STRIPE"`, `coupon_code`, `passengers: [...]`
   - Returns `{ id, pnr, status: "PENDING", total_gross_fare, discount_amount, tax_amount, service_fee, net_amount, expires_at, seats }`.
2. **Initiate Payment:** `POST /api/payments/initiate/`
   - Payload: `{ "pnr": "...", "payment_method": "STRIPE", "success_url": "<app-deep-link-or-return-url>", "cancel_url": "<cancel-url>" }`
   - Returns `{ checkout_url, session_id }`. Open `checkout_url` in browser / WebView.
   - *(Dev Sandbox fallback: `POST /api/payments/confirm-mock/` with `{ "pnr": "...", "status": "SUCCESS" }`.)*
3. **Return & Ticket Issuance:**
   - Verify Stripe session if `session_id` present: `POST /api/payments/verify-stripe-session/` (`{ "session_id": "..." }`).
   - Poll `GET /api/bookings/{pnr}/` every 2s until `status == "CONFIRMED"`.
   - Fetch issued tickets: `GET /api/tickets/booking/{pnr}/` (each ticket includes `ticket_number`, `seat_number`, `passenger_name`, `qr_code_base64`, `status`).
   - Fetch receipt: `GET /api/payments/booking/{pnr}/` → `GET /api/payments/receipt/{receipt_number}/`.
   - Download printable PDF boarding pass: `GET /api/tickets/{ticket_number}/pdf/`.

---

## 5. Authentication & Account Portal

### 5.1 Auth Endpoints
- `POST /api/auth/register/` — `{ full_name, phone, email?, gender, password, role: "PASSENGER" }`
- `POST /api/auth/verify-otp/` — `{ identifier, otp_code (6 digits), purpose: "REGISTRATION" }`
- `POST /api/auth/login/` — `{ identifier (phone or email), password }` → returns `{ access, refresh, user }`
- `POST /api/auth/refresh/` — `{ refresh }` → returns `{ access, refresh }`
- `POST /api/auth/logout/` — `{ refresh }`
- `POST /api/auth/password-reset-request/` — `{ identifier }`
- `POST /api/auth/password-reset-confirm/` — `{ identifier, otp_code, new_password }`

### 5.2 Account Portal Features
- **My Bookings:** `GET /api/bookings/?page=1&page_size=10` with filter tabs (`All`, `Upcoming`, `Past`, `Pending`, `Cancelled`).
- **Quick PNR Lookup (works even as guest):** `GET /api/bookings/{pnr}/`.
- **QR Tickets Modal:** `GET /api/tickets/booking/{pnr}/` + PDF download link.
- **Cancel & Refund Flow:**
  - Estimate refund: `POST /api/cancellations/estimate/` (`{ pnr, seat_ids: [...] }`) → shows `policy_tier`, `non_refundable_service_fee`, `net_refund_amount`.
  - Cancel entire booking: `POST /api/cancellations/cancel-booking/` (`{ pnr, reason }`).
  - Cancel specific seats: `POST /api/cancellations/cancel-seats/` (`{ pnr, seat_ids, reason }`).
  - Refund audit history: `GET /api/cancellations/refunds/{pnr}/`.
- **Saved Companions CRUD:** `GET/POST /api/accounts/saved-passengers/`, `PATCH/DELETE /api/accounts/saved-passengers/{id}/`.
- **Profile Update:** `GET/PUT /api/accounts/profile/`.

---

## 6. Status Badge Color Mapping

Keep status badges consistent with the web UI:

| Status | Visual Tone | Hex |
|---|---|---|
| `CONFIRMED`, `COMPLETED`, `ACTIVE`, `SUCCESS`, `BOARDED` | Success (Emerald) | `#178C61` |
| `ISSUED`, `SCHEDULED` | Info (Royal Blue) | `#1D5BD6` |
| `PENDING`, `INITIATED`, `BOARDING`, `PARTIALLY_CANCELLED` | Warning (Amber) | `#DC7A05` |
| `CANCELLED`, `FAILED`, `EXPIRED`, `NO_SHOW` | Danger (Crimson) | `#DC1840` |
| `REFUNDED`, `RETIRED` | Neutral (Slate) | `#64748B` |

---

## 7. Backend Base URL & Environment Notes

- **Local Development:** `http://127.0.0.1:8000` (use `http://10.0.2.2:8000` on Android Emulator or your LAN IP on physical devices).
- **All API responses** follow the standard envelope:
  - Success: `{ "success": true, "message": "...", "data": ... }`
  - Error: `{ "success": false, "error": { "code": "...", "message": "...", "details": { ... } } }`
- Unwrap `response.data["data"]` in your Dio response helper/interceptor so Riverpod providers receive clean typed models.
