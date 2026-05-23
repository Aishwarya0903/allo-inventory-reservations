import { describe, expect, it, vi } from "vitest";

import {
  createRequestHash,
  runIdempotentJsonRequest,
} from "@/lib/api/idempotency";

function createRequest(
  path: string,
  idempotencyKey?: string,
) {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: idempotencyKey
      ? {
          "Idempotency-Key": idempotencyKey,
        }
      : undefined,
  });
}

function createMemoryStore() {
  const values = new Map<string, string>();

  return {
    delete: vi.fn(async (key: string) => {
      values.delete(key);
    }),
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    set: vi.fn(
      async (
        key: string,
        value: string,
        options?: {
          exSeconds?: number;
          onlyIfAbsent?: boolean;
        },
      ) => {
        if (options?.onlyIfAbsent && values.has(key)) {
          return null;
        }

        values.set(key, value);
        return "OK";
      },
    ),
  };
}

describe("idempotency helper", () => {
  it("bypasses idempotency when the header is missing", async () => {
    const store = createMemoryStore();
    const execute = vi.fn(async () => ({
      status: 201,
      body: { reservation: { id: "reservation_1" } },
    }));

    const result = await runIdempotentJsonRequest({
      request: createRequest("/api/reservations"),
      routeScope: "POST:/api/reservations",
      execute,
      store,
    });

    expect(result).toEqual({
      status: 201,
      body: { reservation: { id: "reservation_1" } },
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(store.get).not.toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
  });

  it("returns 503 when a key is supplied but idempotency storage is not configured", async () => {
    const execute = vi.fn(async () => ({
      status: 201,
      body: { reservation: { id: "reservation_1" } },
    }));

    const result = await runIdempotentJsonRequest({
      request: createRequest("/api/reservations", "reserve-1"),
      routeScope: "POST:/api/reservations",
      execute,
      store: null,
    });

    expect(result).toEqual({
      status: 503,
      body: {
        error: {
          code: "IDEMPOTENCY_NOT_CONFIGURED",
          message: "Idempotency storage is not configured on the server.",
        },
      },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns a stored response for a replayed key", async () => {
    const store = createMemoryStore();
    const firstExecute = vi.fn(async () => ({
      status: 201,
      body: { reservation: { id: "reservation_1" } },
    }));
    const secondExecute = vi.fn(async () => ({
      status: 201,
      body: { reservation: { id: "reservation_2" } },
    }));

    const firstResult = await runIdempotentJsonRequest({
      request: createRequest("/api/reservations", "reserve-1"),
      routeScope: "POST:/api/reservations",
      requestHash: createRequestHash({
        productId: "product_1",
        warehouseId: "warehouse_1",
        quantity: 1,
      }),
      execute: firstExecute,
      store,
    });
    const replayedResult = await runIdempotentJsonRequest({
      request: createRequest("/api/reservations", "reserve-1"),
      routeScope: "POST:/api/reservations",
      requestHash: createRequestHash({
        productId: "product_1",
        warehouseId: "warehouse_1",
        quantity: 1,
      }),
      execute: secondExecute,
      store,
    });

    expect(firstResult).toEqual({
      status: 201,
      body: { reservation: { id: "reservation_1" } },
    });
    expect(replayedResult).toEqual(firstResult);
    expect(firstExecute).toHaveBeenCalledTimes(1);
    expect(secondExecute).not.toHaveBeenCalled();
  });

  it("rejects reusing a reserve key with a different request body", async () => {
    const store = createMemoryStore();

    await runIdempotentJsonRequest({
      request: createRequest("/api/reservations", "reserve-1"),
      routeScope: "POST:/api/reservations",
      requestHash: createRequestHash({
        productId: "product_1",
        warehouseId: "warehouse_1",
        quantity: 1,
      }),
      execute: async () => ({
        status: 201,
        body: { reservation: { id: "reservation_1" } },
      }),
      store,
    });

    const result = await runIdempotentJsonRequest({
      request: createRequest("/api/reservations", "reserve-1"),
      routeScope: "POST:/api/reservations",
      requestHash: createRequestHash({
        productId: "product_1",
        warehouseId: "warehouse_1",
        quantity: 2,
      }),
      execute: async () => ({
        status: 201,
        body: { reservation: { id: "reservation_2" } },
      }),
      store,
    });

    expect(result).toEqual({
      status: 422,
      body: {
        error: {
          code: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST",
          message:
            "This Idempotency-Key was already used with a different request.",
        },
      },
    });
  });
});
