import { z } from "zod";

export const createReservationRequestSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const reservationRouteParamsSchema = z.object({
  id: z.string().min(1),
});

export type CreateReservationRequest = z.infer<
  typeof createReservationRequestSchema
>;
export type ReservationRouteParams = z.infer<
  typeof reservationRouteParamsSchema
>;
