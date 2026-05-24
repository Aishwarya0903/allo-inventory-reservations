import { describe, expect, it } from "vitest";

import {
  formatReservationCountdown,
  getReservationActionErrorMessage,
  isPendingReservationExpired,
  parseReservationDetailResponse,
} from "@/lib/ui/reservation-checkout";

describe("reservation checkout helpers", () => {
  it("formats a reservation countdown in minutes and seconds", () => {
    expect(
      formatReservationCountdown(
        "2026-01-01T10:10:09.000Z",
        new Date("2026-01-01T10:00:00.000Z").getTime(),
      ),
    ).toBe("10:09");
  });

  it("clamps the countdown at zero after expiry", () => {
    expect(
      formatReservationCountdown(
        "2026-01-01T10:00:00.000Z",
        new Date("2026-01-01T10:05:00.000Z").getTime(),
      ),
    ).toBe("00:00");
  });

  it("detects only pending reservations as expired", () => {
    const now = new Date("2026-01-01T10:10:00.000Z").getTime();

    expect(
      isPendingReservationExpired("pending", "2026-01-01T10:09:59.000Z", now),
    ).toBe(true);
    expect(
      isPendingReservationExpired("confirmed", "2026-01-01T10:09:59.000Z", now),
    ).toBe(false);
    expect(
      isPendingReservationExpired("released", "2026-01-01T10:09:59.000Z", now),
    ).toBe(false);
  });

  it("maps a 410 response to a clear expired message", () => {
    expect(
      getReservationActionErrorMessage("confirm", {
        status: 410,
        error: {
          code: "RESERVATION_EXPIRED",
          message: "Reservation expired before it could be confirmed.",
        },
      }),
    ).toBe(
      "Reservation expired before confirmation could complete. Please create a new reservation. (Error 410)",
    );
  });

  it("falls back to the API message for state conflicts", () => {
    expect(
      getReservationActionErrorMessage("release", {
        status: 409,
        error: {
          code: "RESERVATION_ALREADY_CONFIRMED",
          message: "Confirmed reservations cannot be released.",
        },
      }),
    ).toBe("Confirmed reservations cannot be released.");
  });

  it("parses the reservation detail API payload when product and warehouse are present", () => {
    expect(
      parseReservationDetailResponse({
        reservation: {
          id: "res_123",
          quantity: 1,
          status: "pending",
          expiresAt: "2026-01-01T10:10:00.000Z",
          confirmedAt: null,
          releasedAt: null,
          createdAt: "2026-01-01T10:00:00.000Z",
          updatedAt: "2026-01-01T10:00:00.000Z",
          product: {
            id: "prod_123",
            sku: "ALLO-ELECTROLYTE-CITRUS-30",
            name: "Citrus Electrolyte Sticks",
            description: "Hydration sticks",
          },
          warehouse: {
            id: "wh_123",
            code: "BLR-01",
            name: "Bengaluru South Fulfillment",
            city: "Bengaluru",
          },
        },
        expiredOnRead: false,
      }),
    ).toEqual({
      reservation: {
        id: "res_123",
        quantity: 1,
        status: "pending",
        expiresAt: "2026-01-01T10:10:00.000Z",
        confirmedAt: null,
        releasedAt: null,
        createdAt: "2026-01-01T10:00:00.000Z",
        updatedAt: "2026-01-01T10:00:00.000Z",
        product: {
          id: "prod_123",
          sku: "ALLO-ELECTROLYTE-CITRUS-30",
          name: "Citrus Electrolyte Sticks",
          description: "Hydration sticks",
        },
        warehouse: {
          id: "wh_123",
          code: "BLR-01",
          name: "Bengaluru South Fulfillment",
          city: "Bengaluru",
        },
      },
      expiredOnRead: false,
    });
  });

  it("rejects incomplete reservation detail payloads instead of letting the UI crash", () => {
    expect(
      parseReservationDetailResponse({
        reservation: {
          id: "res_123",
          quantity: 1,
          status: "pending",
          expiresAt: "2026-01-01T10:10:00.000Z",
          confirmedAt: null,
          releasedAt: null,
          createdAt: "2026-01-01T10:00:00.000Z",
          updatedAt: "2026-01-01T10:00:00.000Z",
          product: {
            id: "prod_123",
            sku: "ALLO-ELECTROLYTE-CITRUS-30",
            description: "Hydration sticks",
          },
          warehouse: {
            id: "wh_123",
            code: "BLR-01",
            name: "Bengaluru South Fulfillment",
            city: "Bengaluru",
          },
        },
        expiredOnRead: false,
      }),
    ).toBeNull();
  });
});
