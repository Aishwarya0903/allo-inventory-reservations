# Allo Inventory Reservations

## Project Overview

This repository is the foundation for a Next.js App Router application that will model checkout-time inventory reservations for Allo Health's multi-warehouse fulfillment platform.

The goal is to avoid overselling while payment is in progress without making abandoned carts permanently reduce available inventory.

## Assignment Focus

The project now includes the inventory listing, reservation creation flow, and the checkout hold screen used to confirm or release a reservation before payment completes.

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
npm run db:deploy
npm run db:seed
npm run db:studio
TEST_DATABASE_URL="..." npm run test:integration
```

## Environment Variables

Copy `.env.example` to `.env` for local development and fill values as needed.

```bash
DATABASE_URL=
DIRECT_URL=
TEST_DATABASE_URL=
RESERVATION_TTL_MINUTES=10
CRON_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

No Supabase or hosted Postgres connection is required to inspect or build the app. Database commands need valid `DATABASE_URL` and `DIRECT_URL` values.

## Hosted Postgres Setup

The application is designed for hosted Postgres providers such as Supabase and Neon. The Prisma schema and reservation service do not rely on SQLite or any local-only fallback.

Recommended environment setup:

- `DATABASE_URL`: the main application connection string used by Next.js and Prisma Client at runtime. On Supabase or Neon, this can be the pooled connection string if that is what your deployment platform recommends for application traffic.
- `DIRECT_URL`: a direct Postgres connection string for Prisma migrations and schema operations. On Supabase or Neon, this should be the non-pooled connection when the provider exposes a separate direct endpoint.
- `TEST_DATABASE_URL`: an isolated hosted Postgres database or branch used only for the integration harness. This should point at a database where the Prisma schema has been applied and where test data can be created and deleted safely.
- `CRON_SECRET`: a random secret used to protect the production cron endpoint that releases expired reservations.

Typical setup flow:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
TEST_DATABASE_URL="postgresql://..." npm run test:integration
```

For shared hosted environments, prefer running the integration harness against a dedicated preview database, branch database, or disposable test project rather than a developer’s primary dataset.

## Deployment

The app is prepared for deployment to Vercel with a hosted Postgres database.

### Vercel runtime expectations

- Vercel builds the Next.js app and runs the `postinstall` script, which now calls `prisma generate` so the deployed bundle always contains a current Prisma Client.[^prisma-vercel]
- Database migrations are not run automatically during the app build. Apply them separately against the hosted database with `npm run db:deploy`.
- Seeding is also a separate step. Run `npm run db:seed` from a shell that points at the hosted database after the schema is deployed.

### Required Vercel environment variables

Set these in the Vercel project before promoting the deployment:

- `DATABASE_URL`: application runtime connection string. For Supabase or Neon, this can be the pooled URL if that is the provider’s recommended runtime connection.
- `DIRECT_URL`: direct Postgres connection string used by Prisma migrations and schema operations.
- `RESERVATION_TTL_MINUTES`: checkout hold lifetime in minutes. The default local example is `10`.
- `CRON_SECRET`: random bearer secret used by the cron endpoint that releases expired reservations.

Optional but useful outside Vercel:

- `TEST_DATABASE_URL`: hosted Postgres branch or test database used by the integration harness.

### Hosted Postgres deployment flow

For an initial deployment, the safe order is:

```bash
npm run db:generate
npm run db:deploy
npm run db:seed
```

After the database is ready, deploy the application to Vercel. On later schema changes, run `npm run db:deploy` again before or alongside the rollout.

### Cron behavior on Vercel

The repository includes [vercel.json](/Users/yeswanth/Downloads/Projects/allo-inventory-reservations/vercel.json), which configures a cron invocation for:

- `GET /api/cron/release-expired`

The schedule is currently every 10 minutes:

```json
{
  "crons": [
    {
      "path": "/api/cron/release-expired",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

Vercel will send an HTTP `GET` request to that route. When `CRON_SECRET` is configured on the project, Vercel sends it as a bearer token in the `Authorization` header, and the route rejects requests that do not match.[^vercel-cron]

### Deployment checklist

1. Create a hosted Postgres database or branch in Supabase, Neon, or an equivalent provider.
2. Set `DATABASE_URL`, `DIRECT_URL`, `RESERVATION_TTL_MINUTES`, and `CRON_SECRET` in the Vercel project.
3. Run `npm run db:deploy` against the hosted database.
4. Run `npm run db:seed` against the hosted database.
5. Deploy the app to Vercel.
6. Verify the live product listing loads from the hosted database.
7. Verify a reservation can be created from the product listing.
8. Verify confirm succeeds for an active reservation.
9. Verify cancel succeeds for an active reservation.
10. Verify confirming an expired reservation returns HTTP `410`.

### Post-deploy verification

After deployment, the core flow to verify is:

- the product listing page loads real inventory from the hosted database
- reserving from a warehouse row succeeds and navigates to the reservation detail page
- confirming an active reservation succeeds and moves the reservation to `confirmed`
- cancelling an active reservation succeeds and moves the reservation to `released`
- confirming an expired reservation returns `410 Gone`

If you want to verify the real database concurrency path before production traffic, run:

```bash
TEST_DATABASE_URL="postgresql://..." npm run test:integration
```

That remains the honest proof for the last-unit race condition against real Postgres.

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

## API Routes

The Next.js route handlers are intentionally thin and live under `app/api/`.

- `GET /api/products` runs lazy cleanup for expired reservations before reading products, then returns products with warehouse-level `totalUnits`, `reservedUnits`, and computed `availableUnits`.
- `GET /api/warehouses` returns the warehouse list.
- `GET /api/reservations/[id]` returns a reservation with product and warehouse details. If a pending reservation has already expired, the read path releases it first and returns the released state with an `expiredOnRead` flag.
- `GET /api/cron/release-expired` runs a production-safe expiry cleanup sweep when called with `Authorization: Bearer <CRON_SECRET>`.
- `POST /api/reservations` validates the JSON body with Zod and creates a pending reservation.
- `POST /api/reservations/[id]/confirm` confirms a reservation or returns an expiry/state error.
- `POST /api/reservations/[id]/release` releases a reservation or returns a state error.

Error behavior is explicit:

- `NOT_ENOUGH_STOCK` maps to HTTP `409 Conflict`
- invalid reservation state errors also map to HTTP `409 Conflict`
- `RESERVATION_EXPIRED` maps to HTTP `410 Gone`
- `RESERVATION_NOT_FOUND` maps to HTTP `404 Not Found`
- invalid JSON or invalid request bodies map to HTTP `400 Bad Request`

## Product Listing Flow

The home page now acts as the reservation entry point.

- It fetches `GET /api/products` and shows live stock by warehouse.
- Each warehouse row exposes `totalUnits`, `reservedUnits`, and `availableUnits`.
- Users can choose a quantity and attempt a reservation directly from the row.
- A `409 Conflict` response is shown as a visible "Not enough stock available." message.
- Successful reservations navigate to `/reservations/[id]`.
- The reservation detail page fetches the active hold, shows the product and warehouse context, and keeps a live countdown running while the reservation is pending.
- Confirming the hold calls `POST /api/reservations/[id]/confirm` and updates the page to the confirmed state without a manual refresh.
- Cancelling the hold calls `POST /api/reservations/[id]/release` and updates the page to the released state without a manual refresh.
- If the hold expires before confirmation, the UI shows a visible expired message and reflects the released state after the API syncs.

The product listing refreshes inventory after a failed stock conflict so the user sees the latest available units after the backend rejects the request.

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

The unit tests assert the guarded update shape and service state transitions. True concurrency correctness is only validated against real Postgres. The integration harness in `tests/reservation-concurrency.integration.test.ts` is skipped unless `TEST_DATABASE_URL` is set and the target database already has the Prisma schema applied.

That integration harness covers two important Postgres-backed cases:

- two simultaneous `reserveInventory` calls competing for the last unit, where exactly one must succeed and the other must fail with `NOT_ENOUGH_STOCK`
- confirming an already expired pending reservation, where the service must raise `RESERVATION_EXPIRED` and release `reservedUnits` back to stock

The checkout UI tests cover countdown formatting, expired-state detection, and the error messages shown for `404`, `409`, and `410` reservation responses. They do not try to simulate browser-level timing or database concurrency in-memory.

## Expiry Strategy

Expired reservations are handled in two layers:

- Lazy cleanup on user-facing reads:
  - `GET /api/products` releases expired pending reservations before listing inventory.
  - `GET /api/reservations/[id]` releases an expired pending hold before returning reservation detail.
- Scheduled cleanup for production:
  - `GET /api/cron/release-expired` calls `cleanupExpiredReservations`.
  - The route requires `Authorization: Bearer <CRON_SECRET>`.
  - If `CRON_SECRET` is missing on the server, the endpoint returns a `500` configuration error rather than silently running unsecured.

For Vercel deployments, the intended setup is:

1. Add `CRON_SECRET` as a project environment variable.
2. Add a cron entry in `vercel.json` that targets the route.

Example:

```json
{
  "crons": [
    {
      "path": "/api/cron/release-expired",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

Vercel will invoke the configured path with an HTTP `GET` request, and when `CRON_SECRET` is configured on the project it will send the bearer token in the `Authorization` header for the route to verify.[^vercel-cron]

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
- Hosted-Postgres integration harness for last-unit concurrency and expired confirmation behavior
- Product listing UI backed by live API routes
- Reserve flow from warehouse rows into a real reservation detail checkout screen
- Reservation detail API read route with expiry-aware read behavior
- Confirm and release actions from the checkout hold page
- Protected cron endpoint for scheduled expiry cleanup
- Initial Zod schema for future reservation requests

Not complete yet:

- Real Postgres integration run in CI or against hosted test infrastructure
- Payment orchestration beyond reservation confirmation

[^vercel-cron]: Vercel Cron Jobs docs: https://vercel.com/docs/cron-jobs and https://vercel.com/docs/cron-jobs/manage-cron-jobs
[^prisma-vercel]: Prisma deployment guidance for Vercel recommends generating Prisma Client in `postinstall`: https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel
