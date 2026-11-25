# SafarLine (BUSMS) Front-End Monorepo

Next.js 15 Turborepo monorepo for the **SafarLine Intercity Bus Ticket & Operations Management System**, backed by the Django REST API (`http://127.0.0.1:8000`).

## Architecture

- **`apps/web`** (`localhost:3000`): Passenger web portal — SSR corridor search, SEO route & terminal directories, interactive `SeatMap` with dynamic gender & adjacent-female seating guard, 10-minute seat lock countdown, Stripe / Sandbox checkout, QR boarding passes & PDF download, passenger auth & account portal.
- **`apps/admin`** (`localhost:3001`): Operations & Staff Console — KPI overview, Fleet & Seat Layout Studio, Terminals & Route Corridor Builder, Trip Scheduler & Seat Blocking, Counter POS Walk-In Ticketing, Conductor Gate QR Scanner & Manifest, Promotions & Dynamic Yield Pricing, BI Reports & CSV/Excel Exports, and Refunds & Operator Overrides.
- **`packages/ui`**: Shared accessible UI primitives (`SeatMap`, `LockCountdown`, `PaginationBar`, `StatusBadge`, `Button`, `Card`, `Input`, `Alert`, `formatCurrencyPkr`).
- **`packages/config`**: Shared constants, RBAC route guards, Zod schemas, and English (`en`) / Urdu (`ur` RTL) i18n message catalogs.
- **`packages/api-client`**: Typed OpenAPI fetch client, BFF cookie session helpers, and `useAuth` provider.

## Prerequisites

- Node.js `>= 20`
- pnpm `>= 9`
- Running Django backend at `http://127.0.0.1:8000`

## Setup & Commands

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env.local

# 3. Start both apps in development
pnpm dev

# 4. Typecheck, unit tests, and production build
pnpm typecheck
pnpm test
pnpm build
```

> **Note:** When running a verification build alongside a running `pnpm dev` server, isolate the build output directory:
> ```powershell
> $env:NEXT_DIST_DIR = ".next-verify"; pnpm build
> ```

## Environment Variables

See [`.env.example`](.env.example):
- `NEXT_PUBLIC_API_BASE_URL` — Public Django API origin (`http://127.0.0.1:8000`)
- `INTERNAL_API_BASE_URL` — Server-side / BFF Django API origin
- `NEXT_PUBLIC_WEB_URL` / `NEXT_PUBLIC_ADMIN_URL` — App origins
- `AUTH_COOKIE_SECURE` — Set `true` in HTTPS production
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Optional Stripe publishable key

## Docker Compose

```bash
docker compose up --build
```
- Passenger Web: `http://localhost:3000`
- Operations Admin: `http://localhost:3001`
