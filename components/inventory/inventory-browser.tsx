"use client";

import { AlertTriangle, Package2, RefreshCw, Warehouse } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

import { ErrorCallout } from "@/components/inventory/error-callout";
import { Button } from "@/components/ui/button";
import { getReserveErrorMessage } from "@/lib/ui/product-listing";

type ProductResponse = {
  products: Product[];
};

type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  imageUrl: string | null;
  stockLevels: StockLevel[];
};

type StockLevel = {
  id: string;
  warehouse: {
    id: string;
    code: string;
    name: string;
    city: string;
  };
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
};

type ApiError = {
  error: {
    code: string;
    message: string;
  };
};

function getStockRowKey(productId: string, warehouseId: string) {
  return `${productId}:${warehouseId}`;
}

export function InventoryBrowser() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [rowPending, setRowPending] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  async function loadProducts(options?: { background?: boolean }) {
    const background = options?.background ?? false;

    if (background) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setPageError(null);

    try {
      const response = await fetch("/api/products", {
        cache: "no-store",
      });

      if (!response.ok) {
        let message = "Unable to load live inventory right now.";

        try {
          const errorBody = (await response.json()) as ApiError;
          message = errorBody.error.message || message;
        } catch {
          // Fall through to the generic inventory message.
        }

        throw new Error(message);
      }

      const data = (await response.json()) as ProductResponse;
      setProducts(data.products);
      setQuantities((currentQuantities) => {
        const nextQuantities = { ...currentQuantities };

        for (const product of data.products) {
          for (const stockLevel of product.stockLevels) {
            const key = getStockRowKey(product.id, stockLevel.warehouse.id);

            nextQuantities[key] =
              currentQuantities[key] && currentQuantities[key] > 0
                ? currentQuantities[key]
                : 1;
          }
        }

        return nextQuantities;
      });
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to load live inventory right now.",
      );
    } finally {
      if (background) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  function updateQuantity(key: string, value: string) {
    const parsedValue = Number(value);

    setQuantities((currentQuantities) => ({
      ...currentQuantities,
      [key]:
        Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : 1,
    }));
    setRowErrors((currentErrors) => ({
      ...currentErrors,
      [key]: "",
    }));
  }

  async function reserveInventory(product: Product, stockLevel: StockLevel) {
    const rowKey = getStockRowKey(product.id, stockLevel.warehouse.id);
    const quantity = quantities[rowKey] ?? 1;

    setRowPending(rowKey);
    setRowErrors((currentErrors) => ({
      ...currentErrors,
      [rowKey]: "",
    }));

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: stockLevel.warehouse.id,
          quantity,
        }),
      });

      if (!response.ok) {
        const errorBody = (await response.json()) as ApiError;
        const message = getReserveErrorMessage({
          status: response.status,
          error: errorBody.error,
        });

        setRowErrors((currentErrors) => ({
          ...currentErrors,
          [rowKey]: message,
        }));

        if (response.status === 409) {
          await loadProducts({ background: true });
        }

        return;
      }

      const data = (await response.json()) as {
        reservation: { id: string };
      };

      startTransition(() => {
        router.push(`/reservations/${data.reservation.id}`);
      });
    } catch {
      setRowErrors((currentErrors) => ({
        ...currentErrors,
        [rowKey]: "Unable to reserve inventory right now.",
      }));
    } finally {
      setRowPending((currentPending) =>
        currentPending === rowKey ? null : currentPending,
      );
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(203,213,225,0.35),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f7_100%)] text-slate-950">
      <section className="border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-14 sm:px-8 lg:px-10">
          <div className="max-w-4xl">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              Allo inventory reservations
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Reserve live inventory by warehouse before payment completes.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-650">
              This surface shows actual stock, reserved units, and the currently
              available quantity per fulfillment location. Reservation requests
              use the same concurrency-safe service the API relies on.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8 sm:px-8 lg:px-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Product inventory
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Reserve from a specific warehouse row. Availability reflects live
              warehouse stock after holds are applied.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void loadProducts({ background: true })}
            disabled={isLoading || isRefreshing}
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </Button>
        </div>

        {pageError ? (
          <ErrorCallout
            title="Inventory unavailable"
            message={`${pageError} Check the database connection, migration status, and seeded data before retrying.`}
          />
        ) : null}

        {isLoading ? (
          <div className="grid gap-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="rounded-md border border-slate-200 bg-white/85 p-6 shadow-sm"
              >
                <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                <div className="mt-4 h-8 w-52 animate-pulse rounded bg-slate-200" />
                <div className="mt-3 h-4 w-72 animate-pulse rounded bg-slate-100" />
                <div className="mt-6 h-32 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : null}

        {!isLoading && !pageError && products.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-white/90 p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="max-w-2xl">
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">
                  Inventory empty
                </p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">
                  No seeded products were returned by the API.
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-650">
                  The app is running, but the inventory table does not have any
                  product rows yet. Seed the database, or verify the connected
                  environment before retrying this screen.
                </p>
                <div className="mt-5">
                  <Button
                    variant="outline"
                    onClick={() => void loadProducts({ background: true })}
                    disabled={isRefreshing}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                      aria-hidden="true"
                    />
                    Refresh inventory
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {!isLoading && !pageError && products.length > 0 ? (
          <div className="grid gap-5">
            {products.map((product) => (
              <article
                key={product.id}
                className="overflow-hidden rounded-md border border-slate-200 bg-white/90 shadow-sm"
              >
                <div className="border-b border-slate-200 px-6 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-slate-900 text-white">
                          <Package2 className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div>
                          <h3 className="text-xl font-semibold text-slate-950">
                            {product.name}
                          </h3>
                          <p className="mt-1 font-mono text-sm text-slate-500">
                            {product.sku}
                          </p>
                        </div>
                      </div>
                      <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-650">
                        {product.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        <th className="px-6 py-3">Warehouse</th>
                        <th className="px-4 py-3">Total</th>
                        <th className="px-4 py-3">Reserved</th>
                        <th className="px-4 py-3">Available</th>
                        <th className="px-4 py-3">Quantity</th>
                        <th className="px-6 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {product.stockLevels.map((stockLevel) => {
                        const rowKey = getStockRowKey(
                          product.id,
                          stockLevel.warehouse.id,
                        );
                        const rowError = rowErrors[rowKey];
                        const pending = rowPending === rowKey;

                        return (
                          <tr key={rowKey}>
                            <td className="px-6 py-4 align-top">
                              <div className="flex items-start gap-3">
                                <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                                  <Warehouse
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                </span>
                                <div>
                                  <p className="font-semibold text-slate-900">
                                    {stockLevel.warehouse.name}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-600">
                                    {stockLevel.warehouse.code} ·{" "}
                                    {stockLevel.warehouse.city}
                                  </p>
                                  {rowError ? (
                                    <p className="mt-2 max-w-sm text-sm font-medium text-rose-700">
                                      {rowError}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-700">
                              {stockLevel.totalUnits}
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-700">
                              {stockLevel.reservedUnits}
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex min-w-14 justify-center rounded-full px-3 py-1 text-sm font-semibold ${
                                  stockLevel.availableUnits > 0
                                    ? "bg-emerald-50 text-emerald-800"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {stockLevel.availableUnits}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <label className="sr-only" htmlFor={rowKey}>
                                Quantity for {product.name} at{" "}
                                {stockLevel.warehouse.name}
                              </label>
                              <input
                                id={rowKey}
                                type="number"
                                min={1}
                                step={1}
                                value={quantities[rowKey] ?? 1}
                                onChange={(event) =>
                                  updateQuantity(rowKey, event.target.value)
                                }
                                disabled={pending || stockLevel.availableUnits === 0}
                                className="h-10 w-20 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                              />
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Button
                                onClick={() =>
                                  void reserveInventory(product, stockLevel)
                                }
                                disabled={
                                  pending || stockLevel.availableUnits === 0
                                }
                              >
                                {pending
                                  ? "Reserving..."
                                  : stockLevel.availableUnits === 0
                                    ? "Unavailable"
                                    : "Reserve"}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
