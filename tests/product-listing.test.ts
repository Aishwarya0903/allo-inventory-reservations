import { describe, expect, it } from "vitest";

import { getReserveErrorMessage } from "@/lib/ui/product-listing";

describe("product listing helpers", () => {
  it("shows a clear stock message for 409 responses", () => {
    expect(
      getReserveErrorMessage({
        status: 409,
        error: {
          code: "NOT_ENOUGH_STOCK",
          message: "Not enough stock is available for this reservation.",
        },
      }),
    ).toBe("Not enough stock available.");
  });

  it("falls back to the API message for other known failures", () => {
    expect(
      getReserveErrorMessage({
        status: 400,
        error: {
          code: "INVALID_REQUEST_BODY",
          message:
            "productId, warehouseId, and a positive integer quantity are required.",
        },
      }),
    ).toBe(
      "productId, warehouseId, and a positive integer quantity are required.",
    );
  });

  it("returns a generic message for unknown failures", () => {
    expect(getReserveErrorMessage(null)).toBe(
      "Unable to reserve inventory right now.",
    );
  });
});
