import {
  Prisma,
  type PrismaClient,
  type Reservation,
  ReservationStatus,
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  ReservationDomainError,
  reservationErrorCodes,
} from "@/lib/domain/errors";
import { getReservationTtlMinutes } from "@/lib/domain/reservations";

export type ReservationServiceDb = Pick<PrismaClient, "$transaction">;
type TransactionClient = Prisma.TransactionClient;
const reservationDetailInclude = Prisma.validator<Prisma.ReservationInclude>()({
  product: true,
  warehouse: true,
});

export type ReservationDetail = Prisma.ReservationGetPayload<{
  include: typeof reservationDetailInclude;
}>;

type ReserveInventoryInput = {
  productId: string;
  warehouseId: string;
  quantity: number;
};

type ReservationByIdInput = {
  reservationId: string;
};

type CleanupExpiredReservationsResult = {
  releasedCount: number;
};

type ReservationDetailResult = {
  reservation: ReservationDetail;
  expiredOnRead: boolean;
};

type ConfirmReservationResult =
  | { outcome: "confirmed"; reservation: Reservation }
  | { outcome: "already-confirmed"; reservation: Reservation }
  | { outcome: "expired"; reservation: Reservation };

const MINUTE_IN_MS = 60_000;

export async function reserveInventory(
  input: ReserveInventoryInput,
  db: ReservationServiceDb = prisma,
) {
  assertPositiveIntegerQuantity(input.quantity);

  try {
    return await db.$transaction(async (tx) => {
      const reservedRows = await reserveStockUnits(tx, input);

      if (reservedRows === 0) {
        throw new ReservationDomainError(
          reservationErrorCodes.NOT_ENOUGH_STOCK,
          "Not enough stock is available for this reservation.",
        );
      }

      return tx.reservation.create({
        data: {
          productId: input.productId,
          warehouseId: input.warehouseId,
          quantity: input.quantity,
          status: ReservationStatus.pending,
          expiresAt: getReservationExpiry(new Date()),
        },
      });
    });
  } catch (error) {
    if (isReserveWriteConflictError(error)) {
      throw new ReservationDomainError(
        reservationErrorCodes.NOT_ENOUGH_STOCK,
        "Not enough stock is available for this reservation.",
      );
    }

    throw error;
  }
}

export async function getReservationDetail(
  input: ReservationByIdInput,
  db: ReservationServiceDb = prisma,
): Promise<ReservationDetailResult> {
  return db.$transaction(async (tx) => {
    const now = new Date();
    const reservation = await findReservationDetailOrThrow(tx, input.reservationId);

    if (
      reservation.status === ReservationStatus.pending &&
      reservation.expiresAt <= now
    ) {
      await releasePendingReservation(tx, reservation, now);
      return {
        reservation: await findReservationDetailOrThrow(tx, input.reservationId),
        expiredOnRead: true,
      };
    }

    return {
      reservation,
      expiredOnRead: false,
    };
  });
}

export async function confirmReservation(
  input: ReservationByIdInput,
  db: ReservationServiceDb = prisma,
) {
  const result = await db.$transaction(async (tx) => {
    const now = new Date();
    const reservation = await findReservationOrThrow(tx, input.reservationId);

    if (reservation.status === ReservationStatus.confirmed) {
      return {
        outcome: "already-confirmed",
        reservation,
      } satisfies ConfirmReservationResult;
    }

    if (reservation.status === ReservationStatus.released) {
      throw new ReservationDomainError(
        reservationErrorCodes.RESERVATION_ALREADY_RELEASED,
        "Released reservations cannot be confirmed.",
      );
    }

    if (reservation.expiresAt <= now) {
      const releasedReservation = await releasePendingReservation(
        tx,
        reservation,
        now,
      );

      return {
        outcome: "expired",
        reservation: releasedReservation,
      } satisfies ConfirmReservationResult;
    }

    const updatedStock = await tx.stockLevel.updateMany({
      where: {
        productId: reservation.productId,
        warehouseId: reservation.warehouseId,
        totalUnits: { gte: reservation.quantity },
        reservedUnits: { gte: reservation.quantity },
      },
      data: {
        totalUnits: { decrement: reservation.quantity },
        reservedUnits: { decrement: reservation.quantity },
      },
    });

    if (updatedStock.count === 0) {
      throw new ReservationDomainError(
        reservationErrorCodes.NOT_ENOUGH_STOCK,
        "Reserved stock could not be confirmed safely.",
      );
    }

    const confirmedReservation = await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status: ReservationStatus.confirmed,
        confirmedAt: now,
      },
    });

    return {
      outcome: "confirmed",
      reservation: confirmedReservation,
    } satisfies ConfirmReservationResult;
  });

  if (result.outcome === "expired") {
    throw new ReservationDomainError(
      reservationErrorCodes.RESERVATION_EXPIRED,
      "Reservation expired before it could be confirmed.",
    );
  }

  return result.reservation;
}

export async function releaseReservation(
  input: ReservationByIdInput,
  db: ReservationServiceDb = prisma,
) {
  return db.$transaction(async (tx) => {
    const now = new Date();
    const reservation = await findReservationOrThrow(tx, input.reservationId);

    if (reservation.status === ReservationStatus.released) {
      return reservation;
    }

    if (reservation.status === ReservationStatus.confirmed) {
      throw new ReservationDomainError(
        reservationErrorCodes.RESERVATION_ALREADY_CONFIRMED,
        "Confirmed reservations cannot be released.",
      );
    }

    return releasePendingReservation(tx, reservation, now);
  });
}

export async function cleanupExpiredReservations(
  db: ReservationServiceDb = prisma,
): Promise<CleanupExpiredReservationsResult> {
  return db.$transaction(async (tx) => {
    const now = new Date();
    const expiredReservations = await tx.reservation.findMany({
      where: {
        status: ReservationStatus.pending,
        expiresAt: { lte: now },
      },
      orderBy: { expiresAt: "asc" },
    });

    let releasedCount = 0;

    for (const reservation of expiredReservations) {
      await releasePendingReservation(tx, reservation, now);
      releasedCount += 1;
    }

    return { releasedCount };
  });
}

async function reserveStockUnits(
  tx: TransactionClient,
  { productId, warehouseId, quantity }: ReserveInventoryInput,
) {
  return tx.$executeRaw(
    Prisma.sql`
      UPDATE "StockLevel"
      SET
        "reservedUnits" = "reservedUnits" + ${quantity},
        "updatedAt" = NOW()
      WHERE
        "productId" = ${productId}
        AND "warehouseId" = ${warehouseId}
        AND ("totalUnits" - "reservedUnits") >= ${quantity}
    `,
  );
}

async function releasePendingReservation(
  tx: TransactionClient,
  reservation: Reservation,
  releasedAt: Date,
) {
  const updatedStock = await tx.stockLevel.updateMany({
    where: {
      productId: reservation.productId,
      warehouseId: reservation.warehouseId,
      reservedUnits: { gte: reservation.quantity },
    },
    data: {
      reservedUnits: { decrement: reservation.quantity },
    },
  });

  if (updatedStock.count === 0) {
    throw new ReservationDomainError(
      reservationErrorCodes.NOT_ENOUGH_STOCK,
      "Reserved stock could not be released safely.",
    );
  }

  return tx.reservation.update({
    where: { id: reservation.id },
    data: {
      status: ReservationStatus.released,
      releasedAt,
    },
  });
}

async function findReservationOrThrow(
  tx: TransactionClient,
  reservationId: string,
) {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
  });

  if (!reservation) {
    throw new ReservationDomainError(
      reservationErrorCodes.RESERVATION_NOT_FOUND,
      "Reservation was not found.",
    );
  }

  return reservation;
}

async function findReservationDetailOrThrow(
  tx: TransactionClient,
  reservationId: string,
) {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    include: reservationDetailInclude,
  });

  if (!reservation) {
    throw new ReservationDomainError(
      reservationErrorCodes.RESERVATION_NOT_FOUND,
      "Reservation was not found.",
    );
  }

  return reservation;
}

function assertPositiveIntegerQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new ReservationDomainError(
      reservationErrorCodes.INVALID_QUANTITY,
      "Reservation quantity must be a positive integer.",
    );
  }
}

function getReservationExpiry(now: Date) {
  return new Date(now.getTime() + getReservationTtlMinutes() * MINUTE_IN_MS);
}

function isReserveWriteConflictError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    "code" in error &&
    error.name === "PrismaClientKnownRequestError" &&
    error.code === "P2034"
  );
}
