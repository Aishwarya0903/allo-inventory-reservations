import { describe, expect, it } from "vitest";

import {
  calculateAvailableStock,
  getReservationTtlMinutes,
  reservationStatuses,
  validateStockInvariants,
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

  it("calculates available stock from total and reserved units", () => {
    expect(calculateAvailableStock({ totalUnits: 25, reservedUnits: 7 })).toBe(
      18,
    );
  });

  it("accepts valid stock invariants", () => {
    expect(
      validateStockInvariants({ totalUnits: 10, reservedUnits: 10 }),
    ).toEqual({ valid: true });
  });

  it("rejects negative total units", () => {
    expect(
      validateStockInvariants({ totalUnits: -1, reservedUnits: 0 }),
    ).toEqual({
      valid: false,
      reason: "totalUnits must be greater than or equal to 0",
    });
  });

  it("rejects negative reserved units", () => {
    expect(
      validateStockInvariants({ totalUnits: 10, reservedUnits: -1 }),
    ).toEqual({
      valid: false,
      reason: "reservedUnits must be greater than or equal to 0",
    });
  });

  it("rejects reserved units above total units", () => {
    expect(
      validateStockInvariants({ totalUnits: 5, reservedUnits: 6 }),
    ).toEqual({
      valid: false,
      reason: "reservedUnits cannot exceed totalUnits",
    });
  });
});
