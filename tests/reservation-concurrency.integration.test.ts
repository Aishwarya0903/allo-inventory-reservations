import { randomUUID } from "node:crypto";

import { PrismaClient, ReservationStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  ReservationDomainError,
  reservationErrorCodes,
} from "@/lib/domain/errors";
import {
  confirmReservation,
  reserveInventory,
} from "@/lib/domain/reservation-service";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const runWithPostgres = Boolean(testDatabaseUrl);

function createIntegrationDb() {
  if (!testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL must be set to run integration tests.");
  }

  return new PrismaClient({
    datasourceUrl: testDatabaseUrl,
  });
}

function createUniqueSuffix() {
  return randomUUID().slice(0, 8).toUpperCase();
}

async function cleanupReservationFixture(
  db: PrismaClient,
  productId: string,
  warehouseId: string,
) {
  await db.reservation.deleteMany({
    where: { productId, warehouseId },
  });
  await db.stockLevel.deleteMany({
    where: { productId, warehouseId },
  });
  await db.product.deleteMany({
    where: { id: productId },
  });
  await db.warehouse.deleteMany({
    where: { id: warehouseId },
  });
}

describe.skipIf(!runWithPostgres)(
  "reservation service with real Postgres",
  () => {
    it("allows only one reservation for the last available unit", async () => {
      const db = createIntegrationDb();
      const suffix = createUniqueSuffix();
      let productId: string | undefined;
      let warehouseId: string | undefined;

      try {
        const product = await db.product.create({
          data: {
            sku: `ALLO-IT-${suffix}`,
            name: "Integration Concurrency Tee",
            description:
              "Created by the hosted Postgres concurrency integration test.",
          },
        });
        const warehouse = await db.warehouse.create({
          data: {
            code: `IT${suffix}`,
            name: "Integration Concurrency Warehouse",
            city: "Austin",
          },
        });

        productId = product.id;
        warehouseId = warehouse.id;

        await db.stockLevel.create({
          data: {
            productId,
            warehouseId,
            totalUnits: 1,
            reservedUnits: 0,
          },
        });

        const attempts = await Promise.allSettled([
          reserveInventory(
            {
              productId,
              warehouseId,
              quantity: 1,
            },
            db,
          ),
          reserveInventory(
            {
              productId,
              warehouseId,
              quantity: 1,
            },
            db,
          ),
        ]);

        const successes = attempts.filter(
          (attempt) => attempt.status === "fulfilled",
        );
        const failures = attempts.filter(
          (attempt): attempt is PromiseRejectedResult =>
            attempt.status === "rejected",
        );

        expect(successes).toHaveLength(1);
        expect(failures).toHaveLength(1);
        expect(failures[0].reason).toBeInstanceOf(ReservationDomainError);
        expect(failures[0].reason).toMatchObject({
          code: reservationErrorCodes.NOT_ENOUGH_STOCK,
        });

        const stock = await db.stockLevel.findUniqueOrThrow({
          where: {
            productId_warehouseId: {
              productId,
              warehouseId,
            },
          },
        });

        expect(stock.reservedUnits).toBe(1);
        expect(stock.totalUnits).toBe(1);

        const reservations = await db.reservation.findMany({
          where: {
            productId,
            warehouseId,
            status: ReservationStatus.pending,
          },
        });

        expect(reservations).toHaveLength(1);
      } finally {
        if (productId && warehouseId) {
          await cleanupReservationFixture(db, productId, warehouseId);
        }

        await db.$disconnect();
      }
    });

    it("releases reserved stock when confirming an expired reservation", async () => {
      const db = createIntegrationDb();
      const suffix = createUniqueSuffix();
      let productId: string | undefined;
      let warehouseId: string | undefined;
      let reservationId: string | undefined;

      try {
        const product = await db.product.create({
          data: {
            sku: `ALLO-EXP-${suffix}`,
            name: "Integration Expiry Pack",
            description:
              "Created by the hosted Postgres expiry integration test.",
          },
        });
        const warehouse = await db.warehouse.create({
          data: {
            code: `EX${suffix}`,
            name: "Integration Expiry Warehouse",
            city: "Phoenix",
          },
        });

        productId = product.id;
        warehouseId = warehouse.id;

        await db.stockLevel.create({
          data: {
            productId,
            warehouseId,
            totalUnits: 3,
            reservedUnits: 1,
          },
        });

        const reservation = await db.reservation.create({
          data: {
            productId,
            warehouseId,
            quantity: 1,
            status: ReservationStatus.pending,
            expiresAt: new Date(Date.now() - 60_000),
          },
        });

        reservationId = reservation.id;

        await expect(
          confirmReservation(
            {
              reservationId,
            },
            db,
          ),
        ).rejects.toMatchObject({
          code: reservationErrorCodes.RESERVATION_EXPIRED,
        });

        const stock = await db.stockLevel.findUniqueOrThrow({
          where: {
            productId_warehouseId: {
              productId,
              warehouseId,
            },
          },
        });

        expect(stock.reservedUnits).toBe(0);
        expect(stock.totalUnits).toBe(3);

        const releasedReservation = await db.reservation.findUniqueOrThrow({
          where: { id: reservationId },
        });

        expect(releasedReservation.status).toBe(ReservationStatus.released);
        expect(releasedReservation.releasedAt).not.toBeNull();
      } finally {
        if (productId && warehouseId) {
          await cleanupReservationFixture(db, productId, warehouseId);
        }

        await db.$disconnect();
      }
    });
  },
);
