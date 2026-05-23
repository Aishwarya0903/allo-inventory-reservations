type ReservationStatus = "pending" | "confirmed" | "released";

type ReservationApiError = {
  code: string;
  message: string;
};

type ReservationActionErrorInput = {
  status: number;
  error?: ReservationApiError;
};

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
    return "Reservation expired.";
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
