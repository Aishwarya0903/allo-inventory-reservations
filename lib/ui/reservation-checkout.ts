type ReservationStatus = "pending" | "confirmed" | "released";

type ReservationApiError = {
  code: string;
  message: string;
};

type ReservationProduct = {
  id: string;
  sku: string;
  name: string;
  description: string;
};

type ReservationWarehouse = {
  id: string;
  code: string;
  name: string;
  city: string;
};

export type ReservationCheckoutDetail = {
  id: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
  product: ReservationProduct;
  warehouse: ReservationWarehouse;
};

export type ReservationCheckoutApiResponse = {
  reservation: ReservationCheckoutDetail;
  expiredOnRead: boolean;
};

type ReservationActionErrorInput = {
  status: number;
  error?: ReservationApiError;
};

export const reservationExpiredErrorMessage =
  "Reservation expired before confirmation could complete. Please create a new reservation. (Error 410)";

export function parseReservationDetailResponse(
  value: unknown,
): ReservationCheckoutApiResponse | null {
  if (!isRecord(value) || !("reservation" in value) || !("expiredOnRead" in value)) {
    return null;
  }

  if (typeof value.expiredOnRead !== "boolean") {
    return null;
  }

  const reservation = value.reservation;

  if (!isReservationCheckoutDetail(reservation)) {
    return null;
  }

  return {
    reservation,
    expiredOnRead: value.expiredOnRead,
  };
}

export function formatReservationCountdown(
  expiresAt: string,
  now = Date.now(),
) {
  const remainingMs = Math.max(0, new Date(expiresAt).getTime() - now);
  const remainingSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}`;
}

export function isPendingReservationExpired(
  status: ReservationStatus,
  expiresAt: string,
  now = Date.now(),
) {
  return status === "pending" && new Date(expiresAt).getTime() <= now;
}

export function getReservationActionErrorMessage(
  action: "load" | "confirm" | "release",
  failure: ReservationActionErrorInput | null,
) {
  if (!failure) {
    switch (action) {
      case "confirm":
        return "Unable to confirm this reservation right now.";
      case "release":
        return "Unable to cancel this reservation right now.";
      case "load":
      default:
        return "Unable to load this reservation right now.";
    }
  }

  if (failure.status === 404) {
    return "Reservation not found.";
  }

  if (failure.status === 410) {
    return reservationExpiredErrorMessage;
  }

  if (failure.error?.message) {
    return failure.error.message;
  }

  switch (action) {
    case "confirm":
      return "Unable to confirm this reservation right now.";
    case "release":
      return "Unable to cancel this reservation right now.";
    case "load":
    default:
      return "Unable to load this reservation right now.";
  }
}

function isReservationCheckoutDetail(
  value: unknown,
): value is ReservationCheckoutDetail {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.quantity === "number" &&
    (value.status === "pending" ||
      value.status === "confirmed" ||
      value.status === "released") &&
    typeof value.expiresAt === "string" &&
    (typeof value.confirmedAt === "string" || value.confirmedAt === null) &&
    (typeof value.releasedAt === "string" || value.releasedAt === null) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    isReservationProduct(value.product) &&
    isReservationWarehouse(value.warehouse)
  );
}

function isReservationProduct(value: unknown): value is ReservationProduct {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.sku === "string" &&
    typeof value.name === "string" &&
    typeof value.description === "string"
  );
}

function isReservationWarehouse(value: unknown): value is ReservationWarehouse {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.code === "string" &&
    typeof value.name === "string" &&
    typeof value.city === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
