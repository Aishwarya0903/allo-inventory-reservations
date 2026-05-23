import { PrismaClient, ReservationStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { reservationErrorCodes } from "@/lib/domain/errors";
import { reserveInventory } from "@/lib/domain/reservation-service";

const runWithPostgres = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!runWithPostgres)(
  "reservation concurrency with Postgres",
  () => {
    it("allows only one reservation for the last available unit", async () => {
      const db = new PrismaClient({
        datasourceUrl: process.env.TEST_DATABASE_URL,
      });

      const suffix = `test_${Date.now()}`;
      let productId: string | undefined;
      let warehouseId: string | undefined;

      try {
        const product = await db.product.create({
          data: {
            sku: `CONCURRENCY-${suffix}`,
            name: "Concurrency Test Product",
            description: "Created by the skipped Postgres concurrency harness.",
          },
        });
        const warehouse = await db.warehouse.create({
          data: {
            code: `CONCURRENCY-${suffix}`,
            name: "Concurrency Test Warehouse",
            city: "Austin",
          },
        });

        productId = product.id;
        warehouseId = warehouse.id;

        await db.stockLevel.create({
          data: {
            productId: product.id,
            warehouseId: warehouse.id,
            totalUnits: 1,
            reservedUnits: 0,
          },
        });

        const attempts = await Promise.allSettled([
          reserveInventory(
            {
              productId: product.id,
              warehouseId: warehouse.id,
              quantity: 1,
            },
            db,
          ),
          reserveInventory(
            {
              productId: product.id,
              warehouseId: warehouse.id,
              quantity: 1,
            },
            db,
          ),
        ]);

        const successes = attempts.filter(
          (attempt) => attempt.status === "fulfilled",
        );
        const failures = attempts.filter(
          (attempt) => attempt.status === "rejected",
        );

        expect(successes).toHaveLength(1);
        expect(failures).toHaveLength(1);
        expect(failures[0]).toMatchObject({
          reason: { code: reservationErrorCodes.NOT_ENOUGH_STOCK },
        });

        const stock = await db.stockLevel.findUniqueOrThrow({
          where: {
            productId_warehouseId: {
              productId: product.id,
              warehouseId: warehouse.id,
            },
          },
        });
        const reservations = await db.reservation.findMany({
          where: {
            productId: product.id,
            warehouseId: warehouse.id,
            status: ReservationStatus.pending,
          },
        });

        expect(stock.reservedUnits).toBe(1);
        expect(reservations).toHaveLength(1);
      } finally {
        if (productId && warehouseId) {
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

        await db.$disconnect();
      }
    });
  },
);
