import { NextResponse } from "next/server";

import {
  isReservationDomainError,
  reservationErrorCodes,
  type ReservationDomainError,
} from "@/lib/domain/errors";

type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

type ReservationHttpError = {
  status: number;
  code: string;
  message: string;
};

export function jsonData<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(status: number, code: string, message: string) {
  return NextResponse.json<ApiErrorBody>(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

export function mapReservationErrorToHttp(
  error: ReservationDomainError,
): ReservationHttpError {
  switch (error.code) {
    case reservationErrorCodes.INVALID_QUANTITY:
      return { status: 400, code: error.code, message: error.message };
    case reservationErrorCodes.RESERVATION_NOT_FOUND:
      return { status: 404, code: error.code, message: error.message };
    case reservationErrorCodes.RESERVATION_EXPIRED:
      return { status: 410, code: error.code, message: error.message };
    case reservationErrorCodes.NOT_ENOUGH_STOCK:
    case reservationErrorCodes.RESERVATION_ALREADY_RELEASED:
    case reservationErrorCodes.RESERVATION_ALREADY_CONFIRMED:
      return { status: 409, code: error.code, message: error.message };
  }
}

export function reservationErrorResponse(error: unknown) {
  if (isReservationDomainError(error)) {
    const mapped = mapReservationErrorToHttp(error);
    return jsonError(mapped.status, mapped.code, mapped.message);
  }

  return jsonError(
    500,
    "INTERNAL_SERVER_ERROR",
    "An unexpected error occurred.",
  );
}
