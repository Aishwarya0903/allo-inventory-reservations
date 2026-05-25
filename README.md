# Allo Inventory Reservations

## Project Overview

Allo Inventory Reservations is a completed take-home implementation of a checkout-time inventory hold system for multi-warehouse retail and D2C fulfillment.

The app reserves stock when a customer reaches checkout, confirms the reservation after payment succeeds, releases it when payment fails or is cancelled, and releases expired holds automatically. The core goal is to avoid overselling when two checkout requests race for the same final unit without making abandoned carts permanently reduce inventory.

Available stock is always calculated as:

```text
availableUnits = totalUnits - reservedUnits
```

## Live Demo / Deliverables

- GitHub repository: https://github.com/Aishwarya0903/allo-inventory-reservations
- Live deployment: `<add Vercel URL>`

## Assignment Requirement Coverage

| Requirement | Status |
| --- | --- |
| Next.js App Router app | Implemented |
| Products and warehouses | Implemented |
| Stock levels per product and warehouse | Implemented |
| `totalUnits` and `reservedUnits` on stock rows | Implemented |
| Reservation statuses: `pending`, `confirmed`, `released` | Implemented |
| Reservation expiry time with `expiresAt` | Implemented |
| `GET /api/products` | Implemented |
| `GET /api/warehouses` | Implemented |
| `POST /api/reservations` with HTTP `409` for insufficient stock | Implemented |
| `POST /api/reservations/:id/confirm` with HTTP `410` for expired holds | Implemented |
| `POST /api/reservations/:id/release` | Implemented |
| Product listing frontend | Implemented |
| Checkout page with live countdown | Implemented |
| Confirm purchase action | Implemented |
| Cancel hold action | Implemented |
| Visible `409` and `410` UI errors | Implemented |
| Expiry cleanup | Implemented with lazy cleanup and a protected cron endpoint |
| Hosted Postgres-ready setup | Implemented with Prisma Postgres datasource |
| README setup, deployment, and trade-offs | Implemented |
| Optional idempotency bonus for reserve and confirm | Implemented with Upstash Redis when configured |

## Tech Stack

- Next.js App Router
- TypeScript
- Prisma
- Neon Postgres / hosted Postgres
- Upstash Redis REST for optional idempotency
- Zod
- Tailwind CSS
- Vitest
- Vercel

## Architecture / Core Flow

The data model keeps physical stock and active checkout holds separate:

- `Product`: sellable item, keyed by unique `sku`
- `Warehouse`: fulfillment location, keyed by unique `code`
- `StockLevel`: stock for one product at one warehouse
- `Reservation`: checkout hold for one product, warehouse, and quantity

Reservation lifecycle:

1. Reserve
   - Validates `productId`, `warehouseId`, and a positive integer `quantity`.
   - Increments `StockLevel.reservedUnits`.
   - Creates a `pending` reservation with `expiresAt`.
   - Does not decrement `totalUnits`.

2. Confirm
   - Used after payment succeeds.
   - Decrements both `totalUnits` and `reservedUnits`.
   - Marks the reservation `confirmed`.
   - If the hold expired first, releases it and returns an expiry error.

3. Release
   - Used when payment fails or the customer cancels.
   - Decrements `reservedUnits` only.
   - Marks the reservation `released`.

4. Expiry
   - Expired pending reservations are released by lazy cleanup and by the protected cron endpoint.

## Concurrency Strategy

Reservation creation is the most important part of the assignment. It uses a Prisma transaction with an atomic guarded Postgres update:

```sql
UPDATE "StockLevel"
SET
  "reservedUnits" = "reservedUnits" + quantity,
  "updatedAt" = NOW()
WHERE
  "productId" = productId
  AND "warehouseId" = warehouseId
  AND ("totalUnits" - "reservedUnits") >= quantity
```

The guarded update is the concurrency boundary. `reservedUnits` is incremented only if there is enough availability at the database row at the moment the write executes. If the update affects zero rows, the service raises `NOT_ENOUGH_STOCK`, and the API maps it to HTTP `409 Conflict`.

This prevents the last-unit double-sell race: when two simultaneous requests try to reserve the last available unit, only one update can win. The losing request receives the existing not-enough-stock behavior.

A real Postgres integration test exists for this case:

```bash
TEST_DATABASE_URL="postgresql://..." npm run test:integration
```

`npm run test:integration` runs `tests/reservation-concurrency.integration.test.ts` when `TEST_DATABASE_URL` is configured. The normal unit test command excludes integration tests, so `npm run test` does not require hosted Postgres.

## API Reference

### `GET /api/products`

Runs lazy cleanup for expired pending reservations, then returns products with warehouse stock.

Each stock row includes:

- `totalUnits`
- `reservedUnits`
- `availableUnits`
- warehouse details

### `GET /api/warehouses`

Returns all warehouses ordered by code.

### `POST /api/reservations`

Creates a pending reservation.

Request body:

```json
{
  "productId": "product_id",
  "warehouseId": "warehouse_id",
  "quantity": 1
}
```

Important responses:

- `201 Created`: reservation created
- `400 Bad Request`: invalid JSON or invalid request body
- `409 Conflict`: insufficient stock
- `503 Service Unavailable`: `Idempotency-Key` was provided but Upstash Redis is not configured

### `GET /api/reservations/:id`

Returns reservation details with product and warehouse context.

If the reservation is pending and already expired, the read path releases it first and returns the released state with `expiredOnRead: true`.

### `POST /api/reservations/:id/confirm`

Confirms a pending checkout hold after payment success.

Important responses:

- `200 OK`: reservation confirmed, or already confirmed
- `404 Not Found`: reservation does not exist
- `409 Conflict`: reservation is already released or stock cannot be confirmed safely
- `410 Gone`: reservation expired before confirmation
- `503 Service Unavailable`: `Idempotency-Key` was provided but Upstash Redis is not configured

### `POST /api/reservations/:id/release`

Releases a pending checkout hold when checkout is cancelled or payment fails.

Important responses:

- `200 OK`: reservation released, or already released
- `404 Not Found`: reservation does not exist
- `409 Conflict`: reservation is already confirmed

### `GET /api/cron/release-expired`

Protected endpoint for scheduled expiry cleanup.

Security behavior:

- Requires `Authorization: Bearer <CRON_SECRET>`.
- Returns `401 Unauthorized` when the bearer token is missing or invalid.
- Returns `500` when `CRON_SECRET` is missing on the server.

Success response:

```json
{
  "releasedCount": 3,
  "checkedAt": "2026-05-24T00:00:00.000Z"
}
```

## Idempotency Bonus

Idempotency applies to:

- `POST /api/reservations`
- `POST /api/reservations/:id/confirm`

It intentionally does not wrap `POST /api/reservations/:id/release`, because the assignment bonus focuses on reserve and confirm retries.

Behavior:

- Without `Idempotency-Key`, the endpoints behave normally.
- With `Idempotency-Key` and Upstash Redis configured, the first JSON response is stored and replayed for retries.
- Reserve requests include a hash of the validated body, so the same key with the same body returns the original response.
- Reusing the same reserve key with a different body returns `422 Unprocessable Entity`.
- If `Idempotency-Key` is provided but Upstash Redis env vars are missing, the endpoint returns `503` and does not perform the side effect.

Required Upstash env vars:

```bash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

The implementation does not use an in-memory fallback, because that would make retry behavior misleading in production.

## Expiry Strategy

Expiry is handled in two layers.

Lazy cleanup:

- `GET /api/products` releases expired pending reservations before listing inventory.
- `GET /api/reservations/:id` releases an expired pending hold before returning reservation detail.

Scheduled cleanup:

- `GET /api/cron/release-expired` calls `cleanupExpiredReservations`.
- The route requires `Authorization: Bearer <CRON_SECRET>`.
- `vercel.json` schedules the endpoint once per day:

```json
{
  "crons": [
    {
      "path": "/api/cron/release-expired",
      "schedule": "0 3 * * *"
    }
  ]
}
```

Vercel Hobby cron runs daily, so this repository uses a daily schedule that deploys on the Hobby plan. Lazy cleanup keeps the demo behavior correct between daily sweeps. On Vercel Pro, or with a separate worker, the same endpoint could be called more frequently.

## Local Development

Install dependencies:

```bash
npm install
```

Copy the example env file:

```bash
cp .env.example .env
```

Set at least:

```bash
DATABASE_URL=
DIRECT_URL=
```

Generate Prisma Client:

```bash
npm run db:generate
```

For local development against a development database:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

For an already-managed hosted database, deploy migrations instead:

```bash
npm run db:deploy
npm run db:seed
npm run dev
```

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Runtime Postgres connection string for Prisma Client |
| `DIRECT_URL` | Yes | Direct Postgres connection string for Prisma migrations |
| `TEST_DATABASE_URL` | Integration tests only | Isolated hosted Postgres database for `npm run test:integration` |
| `RESERVATION_TTL_MINUTES` | Recommended | Checkout hold lifetime; defaults to `10` when omitted |
| `CRON_SECRET` | Cron endpoint | Bearer secret for `GET /api/cron/release-expired` |
| `UPSTASH_REDIS_REST_URL` | Idempotency only | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Idempotency only | Upstash Redis REST token |

Upstash variables are required only when clients send `Idempotency-Key`. If a key is sent without Upstash configured, the API returns `503` before performing the mutation.

## Testing

Command-line checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Hosted Postgres integration test:

```bash
TEST_DATABASE_URL="postgresql://..." npm run test:integration
```

The unit test suite covers:

- reservation status constants and request validation
- stock availability and invariant helpers
- API error mapping
- reservation service state transitions
- guarded reserve behavior and Prisma write-conflict mapping
- checkout countdown and reservation detail parsing helpers
- idempotency helper behavior
- cron authorization helper behavior

The integration test covers real Postgres behavior for:

- two concurrent `reserveInventory` calls competing for the final unit
- confirming an already expired reservation and releasing `reservedUnits`

The integration test is intentionally separate because true concurrency behavior should be validated against real Postgres, not an in-memory mock.

## Deployment

The app is prepared for Vercel with hosted Postgres.

Recommended deployment stack:

- Vercel for the Next.js app and daily cron
- Neon Postgres or another hosted Postgres provider
- Upstash Redis if the idempotency bonus should be enabled

Deployment steps:

1. Create a hosted Postgres database or branch.
2. Set Vercel env vars: `DATABASE_URL`, `DIRECT_URL`, `RESERVATION_TTL_MINUTES`, and `CRON_SECRET`.
3. Optionally set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
4. Run `npm run db:deploy` against the hosted database.
5. Run `npm run db:seed` against the hosted database.
6. Deploy or redeploy the Vercel app after env var changes.
7. Verify the live product listing, reserve flow, confirm flow, cancel flow, and expired confirm behavior.

`postinstall` runs `prisma generate`, so Vercel builds generate Prisma Client before the Next.js build. Migrations and seed are intentionally separate operational steps, not hidden inside the app build.

## Manual Verification Checklist

- Product inventory loads from the database.
- Reserve succeeds for an available warehouse row.
- Confirm purchase succeeds for an active reservation.
- Cancel hold succeeds for an active reservation.
- A quantity above availability shows the visible `409` message.
- Confirming an expired reservation shows the visible `410` message.
- Theme toggle works.
- Light/dark preference persists after refresh.
- Idempotency works for reserve and confirm when Upstash env vars are configured.

## Trade-offs / Future Improvements

- Vercel Hobby cron runs daily. A production deployment could use Vercel Pro or a separate worker for more frequent background cleanup.
- Real concurrency validation requires a hosted Postgres test database via `TEST_DATABASE_URL`; normal unit tests do not prove database locking behavior.
- Authentication, tenant isolation, and role-based admin access are out of scope for this assignment.
- Payment gateway integration is intentionally simulated through confirm/release endpoints.
- The release endpoint is not idempotency-wrapped because the bonus scope focused on reserve and confirm.
- Production hardening would add structured logging, metrics, tracing, alerting, and operational admin tooling.

