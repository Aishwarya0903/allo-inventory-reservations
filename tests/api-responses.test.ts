import { describe, expect, it } from "vitest";

import {
  ReservationDomainError,
  reservationErrorCodes,
} from "@/lib/domain/errors";
import { mapReservationErrorToHttp } from "@/lib/api/responses";
import { reservationRouteParamsSchema } from "@/lib/validation/reservations";

describe("API response helpers", () => {
  it("maps not enough stock to 409", () => {
    const result = mapReservationErrorToHttp(
      new ReservationDomainError(
        reservationErrorCodes.NOT_ENOUGH_STOCK,
        "Not enough stock is available for this reservation.",
      ),
    );

    expect(result).toEqual({
      status: 409,
      code: reservationErrorCodes.NOT_ENOUGH_STOCK,
      message: "Not enough stock is available for this reservation.",
    });
  });

  it("maps expired reservations to 410", () => {
    const result = mapReservationErrorToHttp(
      new ReservationDomainError(
        reservationErrorCodes.RESERVATION_EXPIRED,
        "Reservation expired before it could be confirmed.",
      ),
    );

    expect(result).toEqual({
      status: 410,
      code: reservationErrorCodes.RESERVATION_EXPIRED,
      message: "Reservation expired before it could be confirmed.",
    });
  });

  it("maps missing reservations to 404", () => {
    const result = mapReservationErrorToHttp(
      new ReservationDomainError(
        reservationErrorCodes.RESERVATION_NOT_FOUND,
        "Reservation was not found.",
      ),
    );

    expect(result.status).toBe(404);
  });

  it("treats invalid reservation states as conflicts", () => {
    const released = mapReservationErrorToHttp(
      new ReservationDomainError(
        reservationErrorCodes.RESERVATION_ALREADY_RELEASED,
        "Released reservations cannot be confirmed.",
      ),
    );
    const confirmed = mapReservationErrorToHttp(
      new ReservationDomainError(
        reservationErrorCodes.RESERVATION_ALREADY_CONFIRMED,
        "Confirmed reservations cannot be released.",
      ),
    );

    expect(released.status).toBe(409);
    expect(confirmed.status).toBe(409);
  });

  it("treats invalid quantity as a bad request", () => {
    const result = mapReservationErrorToHttp(
      new ReservationDomainError(
        reservationErrorCodes.INVALID_QUANTITY,
        "Reservation quantity must be a positive integer.",
      ),
    );

    expect(result.status).toBe(400);
  });

  it("validates reservation route params", () => {
    expect(
      reservationRouteParamsSchema.safeParse({ id: "reservation_123" }).success,
    ).toBe(true);
    expect(reservationRouteParamsSchema.safeParse({ id: "" }).success).toBe(
      false,
    );
  });
});
