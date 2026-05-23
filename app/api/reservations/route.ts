import { jsonError, jsonData, reservationErrorResponse } from "@/lib/api/responses";
import { reserveInventory } from "@/lib/domain/reservation-service";
import { createReservationRequestSchema } from "@/lib/validation/reservations";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsedBody = createReservationRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError(
      400,
      "INVALID_REQUEST_BODY",
      "productId, warehouseId, and a positive integer quantity are required.",
    );
  }

  try {
    const reservation = await reserveInventory(parsedBody.data);
    return jsonData({ reservation }, 201);
  } catch (error) {
    return reservationErrorResponse(error);
  }
}
