# Allo Inventory Reservations

## Project Overview

This repository is the foundation for a Next.js App Router application that will model checkout-time inventory reservations for Allo Health's multi-warehouse fulfillment platform.

The goal is to avoid overselling while payment is in progress without making abandoned carts permanently reduce available inventory.

## Assignment Focus

The project currently includes the application scaffold plus the first database foundation: Prisma models for products, warehouses, stock levels, and reservations.

The reservation endpoint is intentionally not implemented yet.

## Tech Stack

- Next.js App Router
- TypeScript
- Prisma with a Postgres-ready datasource
- Zod
- Tailwind CSS
- shadcn-style UI utilities
- Vitest
- ESLint

## Data Model

The Prisma schema is Postgres-ready and models the inventory domain directly:

- `Product`: sellable item, keyed by unique `sku`
- `Warehouse`: fulfillment location, keyed by unique `code`
- `StockLevel`: inventory for one product in one warehouse
- `Reservation`: checkout hold for a product and warehouse, with `pending`, `confirmed`, or `released` status

`StockLevel` stores both `totalUnits` and `reservedUnits`. Keeping reserved units separate means payment-time holds can temporarily reduce availability without pretending the physical stock has already left the warehouse.

Available stock is calculated as:

```text
totalUnits - reservedUnits
```

The schema enforces uniqueness for one stock row per product and warehouse. Application code will enforce stock invariants such as `reservedUnits <= totalUnits` before writes and inside reservation transactions.

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Run validation checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Prisma commands:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:studio
```

## Environment Variables

Copy `.env.example` to `.env` for local development and fill values as needed.

```bash
DATABASE_URL=
DIRECT_URL=
RESERVATION_TTL_MINUTES=10
CRON_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

No Supabase or hosted Postgres connection is required to inspect or build the app. Database commands need valid `DATABASE_URL` and `DIRECT_URL` values.

## Planned Reservation Flow

When a user proceeds to checkout, the future API will validate the request, calculate available stock for the selected product and warehouse, and create a pending reservation for a short TTL window.

If payment succeeds, the reservation will be confirmed and stock will be permanently decremented. If payment fails or the hold expires, the reservation will be released.

## Reservation Service

The reservation service lives in `lib/domain/reservation-service.ts`. It is intentionally separate from route handlers so the critical stock behavior can be tested directly before adding HTTP concerns.

Current service behavior:

- `reserveInventory` validates quantity, runs a transaction, atomically increments `reservedUnits`, and creates a pending reservation with an expiry timestamp.
- `confirmReservation` handles idempotent confirmed reservations, rejects released reservations, releases expired pending reservations, and confirms active pending reservations by decrementing both `totalUnits` and `reservedUnits`.
- `releaseReservation` releases pending reservations by decrementing only `reservedUnits`, returns already released reservations idempotently, and rejects confirmed reservations.
- `cleanupExpiredReservations` finds expired pending reservations and releases them without allowing `reservedUnits` to go negative.

## Concurrency Strategy

The core reservation write uses a Postgres guarded update inside a Prisma transaction:

```sql
UPDATE "StockLevel"
SET "reservedUnits" = "reservedUnits" + quantity
WHERE "productId" = productId
  AND "warehouseId" = warehouseId
  AND ("totalUnits" - "reservedUnits") >= quantity
```

That single database statement is the concurrency boundary. If two checkout attempts race for the last available unit, Postgres can only let one statement update the row once availability no longer satisfies the condition. The losing request gets a `NOT_ENOUGH_STOCK` domain error, which the future API route can map to HTTP `409`.

The important behavior is that when two simultaneous requests try to reserve the last available unit of the same SKU, exactly one request succeeds and the other receives a conflict response.

The unit tests assert the guarded update shape and service state transitions. End-to-end concurrency still requires a real Postgres test database. A skipped integration harness in `tests/reservation-concurrency.integration.test.ts` runs the two-simultaneous-reservations case when `TEST_DATABASE_URL` is present and the test database has the Prisma schema applied.

## Expiry Strategy

Expired reservations will later be handled with lazy cleanup during reservation attempts plus a cron-safe endpoint for scheduled release work.

The scaffold includes `RESERVATION_TTL_MINUTES`, `CRON_SECRET`, and Upstash placeholders for future deployment-friendly expiry support.

## Current Status

Complete:

- Root-level Next.js App Router scaffold
- TypeScript, Tailwind CSS, ESLint, and Vitest setup
- Prisma client helper using the local-development `globalThis` pattern
- Postgres-ready Prisma models for products, warehouses, stock levels, and reservations
- Prisma seed file with demo retail inventory across multiple warehouses
- Reservation status constants and TTL parsing helper
- Stock availability and invariant helpers
- Reservation service with typed domain errors
- Unit coverage for guarded reserve behavior, confirm/release transitions, and expiry cleanup
- Skipped Postgres integration harness for the last-unit concurrency case
- Initial Zod schema for future reservation requests
- Simple domain-specific landing page

Not complete yet:

- Reservation API routes
- Payment confirmation or release endpoints
- Real Postgres integration run in CI or against hosted test infrastructure
