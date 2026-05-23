# Allo Inventory Reservations

## Project Overview

This repository is the foundation for a Next.js App Router application that will model checkout-time inventory reservations for Allo Health's multi-warehouse fulfillment platform.

The goal is to avoid overselling while payment is in progress without making abandoned carts permanently reduce available inventory.

## Assignment Focus

This first step is only the scaffold and project foundation. It sets up the application structure, TypeScript tooling, Prisma readiness, validation primitives, and a simple landing page that reflects the assignment domain.

The reservation endpoint and persistence models are intentionally not implemented yet.

## Tech Stack

- Next.js App Router
- TypeScript
- Prisma with a Postgres-ready datasource
- Zod
- Tailwind CSS
- shadcn-style UI utilities
- Vitest
- ESLint

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

No real database connection is required for this scaffold step.

## Planned Reservation Flow

When a user proceeds to checkout, the future API will validate the request, calculate available stock for the selected product and warehouse, and create a pending reservation for a short TTL window.

If payment succeeds, the reservation will be confirmed and stock will be permanently decremented. If payment fails or the hold expires, the reservation will be released.

Available stock will be calculated as:

```text
totalUnits - reservedUnits
```

## Concurrency Strategy

The core reservation endpoint will be designed around Postgres transactions and atomic conditional stock updates. The important behavior is that when two simultaneous requests try to reserve the last available unit of the same SKU, exactly one request succeeds and the other receives a conflict response.

This is not implemented yet, but the project is structured so that reservation business logic can live separately from route handlers and be tested directly.

## Expiry Strategy

Expired reservations will later be handled with lazy cleanup during reservation attempts plus a cron-safe endpoint for scheduled release work.

The scaffold includes `RESERVATION_TTL_MINUTES`, `CRON_SECRET`, and Upstash placeholders for future deployment-friendly expiry support.

## Current Status

Complete:

- Root-level Next.js App Router scaffold
- TypeScript, Tailwind CSS, ESLint, and Vitest setup
- Prisma client helper using the local-development `globalThis` pattern
- Reservation status constants and TTL parsing helper
- Initial Zod schema for future reservation requests
- Simple domain-specific landing page

Not complete yet:

- Prisma data models
- Reservation API routes
- Payment confirmation or release endpoints
- Concurrency-safe reservation transaction
- Expiry cleanup implementation
