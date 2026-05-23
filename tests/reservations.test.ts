import { describe, expect, it } from "vitest";

import {
  getReservationTtlMinutes,
  reservationStatuses,
} from "@/lib/domain/reservations";
import { createReservationRequestSchema } from "@/lib/validation/reservations";

describe("reservation foundation", () => {
  it("defines the expected reservation statuses", () => {
    expect(reservationStatuses).toEqual(["pending", "confirmed", "released"]);
  });

  it("parses a positive integer reservation TTL", () => {
    expect(getReservationTtlMinutes("15")).toBe(15);
  });

  it("falls back when reservation TTL is missing or invalid", () => {
    expect(getReservationTtlMinutes()).toBe(10);
    expect(getReservationTtlMinutes("0")).toBe(10);
    expect(getReservationTtlMinutes("not-a-number")).toBe(10);
  });

  it("validates a future reservation request", () => {
    const result = createReservationRequestSchema.safeParse({
      productId: "product_123",
      warehouseId: "warehouse_456",
      quantity: 1,
    });

    expect(result.success).toBe(true);
  });

  it("rejects non-positive quantities", () => {
    const result = createReservationRequestSchema.safeParse({
      productId: "product_123",
      warehouseId: "warehouse_456",
      quantity: 0,
    });

    expect(result.success).toBe(false);
  });
});
