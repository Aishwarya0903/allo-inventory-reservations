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

## Concurrency Strategy

The core reservation endpoint will be designed around Postgres transactions and atomic conditional stock updates. Reservation correctness belongs in the service/API layer, where the write can check availability and increment `reservedUnits` as one guarded operation.

The important behavior is that when two simultaneous requests try to reserve the last available unit of the same SKU, exactly one request succeeds and the other receives a conflict response.

This is not implemented yet, but the project is structured so reservation business logic can live separately from route handlers and be tested directly.

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
- Initial Zod schema for future reservation requests
- Simple domain-specific landing page

Not complete yet:

- Reservation API routes
- Payment confirmation or release endpoints
- Concurrency-safe reservation transaction
- Expiry cleanup implementation
