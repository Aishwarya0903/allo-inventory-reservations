import { jsonError, jsonData, reservationErrorResponse } from "@/lib/api/responses";
import { confirmReservation } from "@/lib/domain/reservation-service";
import { reservationRouteParamsSchema } from "@/lib/validation/reservations";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_: Request, context: RouteContext) {
  const parsedParams = reservationRouteParamsSchema.safeParse(
    await context.params,
  );

  if (!parsedParams.success) {
    return jsonError(400, "INVALID_ROUTE_PARAMS", "A reservation id is required.");
  }

  try {
    const reservation = await confirmReservation({
      reservationId: parsedParams.data.id,
    });

    return jsonData({ reservation });
  } catch (error) {
    return reservationErrorResponse(error);
  }
}
