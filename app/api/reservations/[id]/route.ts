import { jsonError, jsonData, reservationErrorResponse } from "@/lib/api/responses";
import { getReservationDetail } from "@/lib/domain/reservation-service";
import { reservationRouteParamsSchema } from "@/lib/validation/reservations";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const parsedParams = reservationRouteParamsSchema.safeParse(
    await context.params,
  );

  if (!parsedParams.success) {
    return jsonError(400, "INVALID_ROUTE_PARAMS", "A reservation id is required.");
  }

  try {
    const result = await getReservationDetail({
      reservationId: parsedParams.data.id,
    });

    return jsonData(result);
  } catch (error) {
    return reservationErrorResponse(error);
  }
}
