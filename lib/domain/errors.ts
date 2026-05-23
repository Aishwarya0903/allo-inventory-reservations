export const reservationErrorCodes = {
  NOT_ENOUGH_STOCK: "NOT_ENOUGH_STOCK",
  RESERVATION_NOT_FOUND: "RESERVATION_NOT_FOUND",
  RESERVATION_EXPIRED: "RESERVATION_EXPIRED",
  RESERVATION_ALREADY_RELEASED: "RESERVATION_ALREADY_RELEASED",
  RESERVATION_ALREADY_CONFIRMED: "RESERVATION_ALREADY_CONFIRMED",
  INVALID_QUANTITY: "INVALID_QUANTITY",
} as const;

export type ReservationErrorCode =
  (typeof reservationErrorCodes)[keyof typeof reservationErrorCodes];

export class ReservationDomainError extends Error {
  readonly code: ReservationErrorCode;

  constructor(code: ReservationErrorCode, message: string) {
    super(message);
    this.name = "ReservationDomainError";
    this.code = code;
  }
}

export function isReservationDomainError(
  error: unknown,
): error is ReservationDomainError {
  return error instanceof ReservationDomainError;
}
