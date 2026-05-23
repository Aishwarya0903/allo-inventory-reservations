import { runIdempotentJsonRequest } from "@/lib/api/idempotency";
import {
  jsonError,
  jsonPayload,
  jsonResponse,
  reservationErrorPayload,
} from "@/lib/api/responses";
import { confirmReservation } from "@/lib/domain/reservation-service";
import { reservationRouteParamsSchema } from "@/lib/validation/reservations";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const parsedParams = reservationRouteParamsSchema.safeParse(
    await context.params,
  );

  if (!parsedParams.success) {
    return jsonError(400, "INVALID_ROUTE_PARAMS", "A reservation id is required.");
  }

  const result = await runIdempotentJsonRequest({
    request,
    routeScope: `POST:/api/reservations/${parsedParams.data.id}/confirm`,
    execute: async () => {
      try {
        const reservation = await confirmReservation({
          reservationId: parsedParams.data.id,
        });

        return jsonPayload({ reservation });
      } catch (error) {
        return reservationErrorPayload(error);
      }
    },
  });

  return jsonResponse(result);
}
