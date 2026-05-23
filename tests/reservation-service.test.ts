import { ReservationStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  ReservationDomainError,
  reservationErrorCodes,
} from "@/lib/domain/errors";
import {
  cleanupExpiredReservations,
  confirmReservation,
  releaseReservation,
  reserveInventory,
  type ReservationServiceDb,
} from "@/lib/domain/reservation-service";

const baseReservation = {
  id: "reservation_1",
  productId: "product_1",
  warehouseId: "warehouse_1",
  quantity: 1,
  status: ReservationStatus.pending,
  expiresAt: new Date("2026-01-01T10:10:00.000Z"),
  confirmedAt: null,
  releasedAt: null,
  createdAt: new Date("2026-01-01T10:00:00.000Z"),
  updatedAt: new Date("2026-01-01T10:00:00.000Z"),
};

function createMockDb(txOverrides: Record<string, unknown> = {}) {
  const tx = {
    $executeRaw: vi.fn(),
    reservation: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    stockLevel: {
      updateMany: vi.fn(),
    },
    ...txOverrides,
  };

  return {
    tx,
    db: {
      $transaction: vi.fn(async (callback: (txClient: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as ReservationServiceDb,
  };
}

describe("reservation service", () => {
  it("rejects invalid reservation quantities", async () => {
    const { db } = createMockDb();

    await expect(
      reserveInventory(
        {
          productId: "product_1",
          warehouseId: "warehouse_1",
          quantity: 0,
        },
        db,
      ),
    ).rejects.toMatchObject({
      code: reservationErrorCodes.INVALID_QUANTITY,
    });

    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("uses an atomic guarded stock update before creating a pending reservation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00.000Z"));

    const { db, tx } = createMockDb();
    tx.$executeRaw.mockResolvedValue(1);
    tx.reservation.create.mockResolvedValue(baseReservation);

    const reservation = await reserveInventory(
      {
        productId: "product_1",
        warehouseId: "warehouse_1",
        quantity: 2,
      },
      db,
    );

    expect(reservation).toBe(baseReservation);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.reservation.create).toHaveBeenCalledWith({
      data: {
        productId: "product_1",
        warehouseId: "warehouse_1",
        quantity: 2,
        status: ReservationStatus.pending,
        expiresAt: new Date("2026-01-01T10:10:00.000Z"),
      },
    });

    const guardedUpdate = tx.$executeRaw.mock.calls[0][0];
    expect(guardedUpdate.strings.join(" ")).toContain(
      '("totalUnits" - "reservedUnits") >=',
    );
    expect(guardedUpdate.values).toEqual([2, "product_1", "warehouse_1", 2]);

    vi.useRealTimers();
  });

  it("reports not enough stock when the guarded update affects no rows", async () => {
    const { db, tx } = createMockDb();
    tx.$executeRaw.mockResolvedValue(0);

    await expect(
      reserveInventory(
        {
          productId: "product_1",
          warehouseId: "warehouse_1",
          quantity: 1,
        },
        db,
      ),
    ).rejects.toMatchObject({
      code: reservationErrorCodes.NOT_ENOUGH_STOCK,
    });

    expect(tx.reservation.create).not.toHaveBeenCalled();
  });

  it("confirms a pending reservation by decrementing total and reserved units", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:05:00.000Z"));

    const confirmedReservation = {
      ...baseReservation,
      status: ReservationStatus.confirmed,
      confirmedAt: new Date("2026-01-01T10:05:00.000Z"),
    };
    const { db, tx } = createMockDb();
    tx.reservation.findUnique.mockResolvedValue(baseReservation);
    tx.stockLevel.updateMany.mockResolvedValue({ count: 1 });
    tx.reservation.update.mockResolvedValue(confirmedReservation);

    const reservation = await confirmReservation(
      { reservationId: "reservation_1" },
      db,
    );

    expect(reservation).toBe(confirmedReservation);
    expect(tx.stockLevel.updateMany).toHaveBeenCalledWith({
      where: {
        productId: "product_1",
        warehouseId: "warehouse_1",
        totalUnits: { gte: 1 },
        reservedUnits: { gte: 1 },
      },
      data: {
        totalUnits: { decrement: 1 },
        reservedUnits: { decrement: 1 },
      },
    });
    expect(tx.reservation.update).toHaveBeenCalledWith({
      where: { id: "reservation_1" },
      data: {
        status: ReservationStatus.confirmed,
        confirmedAt: new Date("2026-01-01T10:05:00.000Z"),
      },
    });

    vi.useRealTimers();
  });

  it("returns an already confirmed reservation idempotently", async () => {
    const confirmedReservation = {
      ...baseReservation,
      status: ReservationStatus.confirmed,
    };
    const { db, tx } = createMockDb();
    tx.reservation.findUnique.mockResolvedValue(confirmedReservation);

    await expect(
      confirmReservation({ reservationId: "reservation_1" }, db),
    ).resolves.toBe(confirmedReservation);

    expect(tx.stockLevel.updateMany).not.toHaveBeenCalled();
    expect(tx.reservation.update).not.toHaveBeenCalled();
  });

  it("rejects confirming a released reservation", async () => {
    const releasedReservation = {
      ...baseReservation,
      status: ReservationStatus.released,
    };
    const { db, tx } = createMockDb();
    tx.reservation.findUnique.mockResolvedValue(releasedReservation);

    await expect(
      confirmReservation({ reservationId: "reservation_1" }, db),
    ).rejects.toMatchObject({
      code: reservationErrorCodes.RESERVATION_ALREADY_RELEASED,
    });
  });

  it("releases an expired pending reservation before reporting expiration", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:11:00.000Z"));

    const expiredReservation = {
      ...baseReservation,
      expiresAt: new Date("2026-01-01T10:10:00.000Z"),
    };
    const { db, tx } = createMockDb();
    tx.reservation.findUnique.mockResolvedValue(expiredReservation);
    tx.stockLevel.updateMany.mockResolvedValue({ count: 1 });
    tx.reservation.update.mockResolvedValue({
      ...expiredReservation,
      status: ReservationStatus.released,
      releasedAt: new Date("2026-01-01T10:11:00.000Z"),
    });

    await expect(
      confirmReservation({ reservationId: "reservation_1" }, db),
    ).rejects.toMatchObject({
      code: reservationErrorCodes.RESERVATION_EXPIRED,
    });

    expect(tx.stockLevel.updateMany).toHaveBeenCalledWith({
      where: {
        productId: "product_1",
        warehouseId: "warehouse_1",
        reservedUnits: { gte: 1 },
      },
      data: {
        reservedUnits: { decrement: 1 },
      },
    });
    expect(tx.reservation.update).toHaveBeenCalledWith({
      where: { id: "reservation_1" },
      data: {
        status: ReservationStatus.released,
        releasedAt: new Date("2026-01-01T10:11:00.000Z"),
      },
    });

    vi.useRealTimers();
  });

  it("releases a pending reservation without decrementing total units", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:04:00.000Z"));

    const releasedReservation = {
      ...baseReservation,
      status: ReservationStatus.released,
      releasedAt: new Date("2026-01-01T10:04:00.000Z"),
    };
    const { db, tx } = createMockDb();
    tx.reservation.findUnique.mockResolvedValue(baseReservation);
    tx.stockLevel.updateMany.mockResolvedValue({ count: 1 });
    tx.reservation.update.mockResolvedValue(releasedReservation);

    const reservation = await releaseReservation(
      { reservationId: "reservation_1" },
      db,
    );

    expect(reservation).toBe(releasedReservation);
    expect(tx.stockLevel.updateMany).toHaveBeenCalledWith({
      where: {
        productId: "product_1",
        warehouseId: "warehouse_1",
        reservedUnits: { gte: 1 },
      },
      data: {
        reservedUnits: { decrement: 1 },
      },
    });

    vi.useRealTimers();
  });

  it("returns an already released reservation idempotently", async () => {
    const releasedReservation = {
      ...baseReservation,
      status: ReservationStatus.released,
    };
    const { db, tx } = createMockDb();
    tx.reservation.findUnique.mockResolvedValue(releasedReservation);

    await expect(
      releaseReservation({ reservationId: "reservation_1" }, db),
    ).resolves.toBe(releasedReservation);

    expect(tx.stockLevel.updateMany).not.toHaveBeenCalled();
    expect(tx.reservation.update).not.toHaveBeenCalled();
  });

  it("rejects releasing an already confirmed reservation", async () => {
    const confirmedReservation = {
      ...baseReservation,
      status: ReservationStatus.confirmed,
    };
    const { db, tx } = createMockDb();
    tx.reservation.findUnique.mockResolvedValue(confirmedReservation);

    await expect(
      releaseReservation({ reservationId: "reservation_1" }, db),
    ).rejects.toMatchObject({
      code: reservationErrorCodes.RESERVATION_ALREADY_CONFIRMED,
    });
  });

  it("reports missing reservations consistently", async () => {
    const { db, tx } = createMockDb();
    tx.reservation.findUnique.mockResolvedValue(null);

    await expect(
      confirmReservation({ reservationId: "missing_reservation" }, db),
    ).rejects.toMatchObject({
      code: reservationErrorCodes.RESERVATION_NOT_FOUND,
    });
  });

  it("cleans up expired pending reservations", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:30:00.000Z"));

    const expiredReservation = {
      ...baseReservation,
      expiresAt: new Date("2026-01-01T10:10:00.000Z"),
    };
    const { db, tx } = createMockDb();
    tx.reservation.findMany.mockResolvedValue([expiredReservation]);
    tx.stockLevel.updateMany.mockResolvedValue({ count: 1 });
    tx.reservation.update.mockResolvedValue({
      ...expiredReservation,
      status: ReservationStatus.released,
      releasedAt: new Date("2026-01-01T10:30:00.000Z"),
    });

    const result = await cleanupExpiredReservations(db);

    expect(result).toEqual({ releasedCount: 1 });
    expect(tx.reservation.findMany).toHaveBeenCalledWith({
      where: {
        status: ReservationStatus.pending,
        expiresAt: { lte: new Date("2026-01-01T10:30:00.000Z") },
      },
      orderBy: { expiresAt: "asc" },
    });

    vi.useRealTimers();
  });

  it("exposes typed domain errors for future API mapping", () => {
    const error = new ReservationDomainError(
      reservationErrorCodes.NOT_ENOUGH_STOCK,
      "Not enough stock is available for this reservation.",
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(reservationErrorCodes.NOT_ENOUGH_STOCK);
  });
});
