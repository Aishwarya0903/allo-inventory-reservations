type ApiErrorPayload = {
  status: number;
  error: {
    code: string;
    message: string;
  };
};

export function getReserveErrorMessage(error: ApiErrorPayload | null) {
  if (!error) {
    return "Unable to reserve inventory right now.";
  }

  if (error.status === 409 && error.error.code === "NOT_ENOUGH_STOCK") {
    return "Not enough stock available in this warehouse. Inventory has been refreshed.";
  }

  return error.error.message || "Unable to reserve inventory right now.";
}
