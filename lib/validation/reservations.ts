import { z } from "zod";

export const createReservationRequestSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.number().int().positive(),
});

export type CreateReservationRequest = z.infer<
  typeof createReservationRequestSchema
>;
