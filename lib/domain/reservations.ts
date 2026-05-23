const DEFAULT_RESERVATION_TTL_MINUTES = 10;

export const reservationStatuses = ["pending", "confirmed", "released"] as const;

export type ReservationStatus = (typeof reservationStatuses)[number];

type StockUnits = {
  totalUnits: number;
  reservedUnits: number;
};

type StockInvariantResult =
  | { valid: true }
  | {
      valid: false;
      reason:
        | "totalUnits must be greater than or equal to 0"
        | "reservedUnits must be greater than or equal to 0"
        | "reservedUnits cannot exceed totalUnits";
    };

export function getReservationTtlMinutes(
  envValue = process.env.RESERVATION_TTL_MINUTES,
) {
  if (!envValue) {
    return DEFAULT_RESERVATION_TTL_MINUTES;
  }

  const parsedValue = Number(envValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return DEFAULT_RESERVATION_TTL_MINUTES;
  }

  return parsedValue;
}

export function calculateAvailableStock({
  totalUnits,
  reservedUnits,
}: StockUnits) {
  return totalUnits - reservedUnits;
}

export function validateStockInvariants({
  totalUnits,
  reservedUnits,
}: StockUnits): StockInvariantResult {
  if (totalUnits < 0) {
    return {
      valid: false,
      reason: "totalUnits must be greater than or equal to 0",
    };
  }

  if (reservedUnits < 0) {
    return {
      valid: false,
      reason: "reservedUnits must be greater than or equal to 0",
    };
  }

  if (reservedUnits > totalUnits) {
    return {
      valid: false,
      reason: "reservedUnits cannot exceed totalUnits",
    };
  }

  return { valid: true };
}
