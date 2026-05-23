const DEFAULT_RESERVATION_TTL_MINUTES = 10;

export const reservationStatuses = ["pending", "confirmed", "released"] as const;

export type ReservationStatus = (typeof reservationStatuses)[number];

export function getReservationTtlMinutes(envValue = process.env.RESERVATION_TTL_MINUTES) {
  if (!envValue) {
    return DEFAULT_RESERVATION_TTL_MINUTES;
  }

  const parsedValue = Number(envValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return DEFAULT_RESERVATION_TTL_MINUTES;
  }

  return parsedValue;
}
