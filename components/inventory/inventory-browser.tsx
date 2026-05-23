"use client";

import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Clock3,
  Package2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Warehouse,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";

import { ErrorCallout } from "@/components/inventory/error-callout";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/ui/site-header";
import {
  getReserveErrorMessage,
  summarizeInventory,
} from "@/lib/ui/product-listing";

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

type InventoryBrowserProps = {
  reservationTtlMinutes: number;
};

function formatMetric(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function getProductInitial(productName: string) {
  return productName.charAt(0).toUpperCase();
}

export function InventoryBrowser({
  reservationTtlMinutes,
}: InventoryBrowserProps) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [rowPending, setRowPending] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const inventorySummary = useMemo(
    () => summarizeInventory(products),
    [products],
  );

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
    <main className="min-h-screen pb-16 text-[var(--foreground)]">
      <SiteHeader currentPath="inventory" />

      <section className="mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 lg:px-8">
        <div className="surface-card-strong surface-highlight grid overflow-hidden rounded-[36px] border border-app-strong lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            <span className="accent-pill inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-medium uppercase tracking-[0.24em]">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Concurrency-safe checkout holds
            </span>
            <h1 className="font-display mt-6 max-w-3xl text-5xl leading-[0.96] tracking-[-0.03em] text-[var(--foreground)] sm:text-6xl lg:text-7xl">
              Reserve inventory before payment completes.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-app-muted sm:text-lg">
              Hold units at checkout, confirm on payment success, and release
              failed or expired holds automatically across every warehouse row.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                onClick={() => {
                  const inventorySection = document.getElementById(
                    "inventory-section",
                  );
                  inventorySection?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Review live inventory
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => void loadProducts({ background: true })}
                disabled={isLoading || isRefreshing}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                Refresh inventory
              </Button>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                "Atomic stock guard",
                "Warehouse-specific holds",
                "TTL-backed cleanup",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[22px] border border-app-soft bg-app-veil px-4 py-4 text-sm text-app-muted"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-app-soft px-6 py-8 sm:px-8 lg:border-l lg:border-t-0 lg:px-8 lg:py-10">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-app-soft">
              <Sparkles className="h-4 w-4 text-[var(--accent-strong)]" aria-hidden="true" />
              Checkout summary
            </div>

            {isLoading ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-[24px] border border-app-soft bg-app-veil p-5"
                  >
                    <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />
                    <div className="mt-5 h-10 w-24 animate-pulse rounded-full bg-white/10" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <MetricCard
                  label="Active warehouses"
                  value={String(inventorySummary.warehouseCount)}
                  icon={<Warehouse className="h-4 w-4" aria-hidden="true" />}
                />
                <MetricCard
                  label="Available units"
                  value={formatMetric(inventorySummary.availableUnits)}
                  icon={<Boxes className="h-4 w-4" aria-hidden="true" />}
                />
                <MetricCard
                  label="Reserved units"
                  value={formatMetric(inventorySummary.reservedUnits)}
                  icon={<Package2 className="h-4 w-4" aria-hidden="true" />}
                />
                <MetricCard
                  label="Reservation TTL"
                  value={`${reservationTtlMinutes} min`}
                  icon={<Clock3 className="h-4 w-4" aria-hidden="true" />}
                />
              </div>
            )}

            <div className="mt-6 rounded-[28px] border border-app-soft bg-[linear-gradient(135deg,rgba(223,242,164,0.16),rgba(255,255,255,0.02))] p-5">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-app-soft">
                Stock posture
              </p>
              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                    {isLoading ? "—" : formatMetric(inventorySummary.totalUnits)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-app-muted">
                    Total units currently represented across the live warehouse
                    snapshot.
                  </p>
                </div>
                <div className="rounded-full border border-app-soft px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-app-muted">
                  Availability = total − reserved
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="inventory-section"
        className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8"
      >
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-app-soft">
              Live warehouse inventory
            </p>
            <h2 className="font-display mt-3 text-3xl tracking-[-0.02em] text-[var(--foreground)] sm:text-4xl">
              Stock after active checkout holds.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-app-muted sm:text-base">
              Reserve from a specific warehouse row. Available units already
              reflect in-flight holds, so this screen tracks the actual inventory
              left for checkout allocation.
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
          <div className="grid gap-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="surface-card overflow-hidden rounded-[34px] px-6 py-6 sm:px-8"
              >
                <div className="h-4 w-32 animate-pulse rounded-full bg-white/10" />
                <div className="mt-5 h-12 w-64 animate-pulse rounded-full bg-white/10" />
                <div className="mt-4 h-4 w-80 animate-pulse rounded-full bg-white/10" />
                <div className="mt-8 grid gap-4 lg:grid-cols-2">
                  {Array.from({ length: 2 }).map((__, rowIndex) => (
                    <div
                      key={rowIndex}
                      className="h-44 animate-pulse rounded-[28px] border border-app-soft bg-app-veil"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!isLoading && !pageError && products.length === 0 ? (
          <div className="surface-card rounded-[34px] px-6 py-8 sm:px-8">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-app-soft bg-app-veil text-[var(--foreground)]">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="max-w-2xl">
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-app-soft">
                  Inventory empty
                </p>
                <h3 className="font-display mt-3 text-3xl tracking-[-0.02em] text-[var(--foreground)]">
                  No seeded products were returned by the API.
                </h3>
                <p className="mt-4 text-sm leading-7 text-app-muted">
                  The app is running, but the inventory surface does not have any
                  product rows yet. Seed the database or verify the connected
                  environment before retrying this screen.
                </p>
                <div className="mt-6">
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
          <div className="grid gap-6">
            {products.map((product) => (
              <article
                key={product.id}
                className="surface-card-strong overflow-hidden rounded-[34px]"
              >
                <div className="grid gap-6 border-b border-app-soft px-6 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-end">
                  <div>
                    <div className="flex items-start gap-4">
                      <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-app-soft bg-[linear-gradient(135deg,rgba(223,242,164,0.18),rgba(222,129,99,0.16))] text-xl font-semibold text-[var(--foreground)]">
                        {getProductInitial(product.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-app-soft">
                          {product.sku}
                        </p>
                        <h3 className="font-display mt-2 text-3xl tracking-[-0.02em] text-[var(--foreground)]">
                          {product.name}
                        </h3>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-app-muted sm:text-base">
                          {product.description}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <ProductStatCard
                      label="Warehouses"
                      value={String(product.stockLevels.length)}
                    />
                    <ProductStatCard
                      label="Reserved"
                      value={formatMetric(
                        product.stockLevels.reduce(
                          (sum, stockLevel) => sum + stockLevel.reservedUnits,
                          0,
                        ),
                      )}
                    />
                    <ProductStatCard
                      label="Available"
                      value={formatMetric(
                        product.stockLevels.reduce(
                          (sum, stockLevel) => sum + stockLevel.availableUnits,
                          0,
                        ),
                      )}
                    />
                  </div>
                </div>

                <div className="grid gap-4 px-6 py-6 sm:px-8">
                  {product.stockLevels.map((stockLevel) => {
                    const rowKey = getStockRowKey(
                      product.id,
                      stockLevel.warehouse.id,
                    );
                    const rowError = rowErrors[rowKey];
                    const pending = rowPending === rowKey;
                    const unavailable = stockLevel.availableUnits === 0;

                    return (
                      <section
                        key={rowKey}
                        className="rounded-[28px] border border-app-soft bg-app-veil px-5 py-5 transition hover:border-app-strong hover:bg-[var(--surface-strong)] sm:px-6"
                      >
                        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                          <div>
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-app-soft bg-[var(--surface)] text-[var(--foreground)]">
                                  <Warehouse className="h-5 w-5" aria-hidden="true" />
                                </span>
                                <div>
                                  <p className="text-lg font-semibold text-[var(--foreground)]">
                                    {stockLevel.warehouse.name}
                                  </p>
                                  <p className="mt-1 text-sm text-app-muted">
                                    {stockLevel.warehouse.code} ·{" "}
                                    {stockLevel.warehouse.city}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ${
                                  unavailable
                                    ? "border border-app-soft bg-app-surface text-app-soft"
                                    : "accent-pill"
                                }`}
                              >
                                {stockLevel.availableUnits} available
                              </span>
                            </div>

                            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                              <WarehouseMetric
                                label="Total units"
                                value={formatMetric(stockLevel.totalUnits)}
                              />
                              <WarehouseMetric
                                label="Reserved units"
                                value={formatMetric(stockLevel.reservedUnits)}
                              />
                              <WarehouseMetric
                                label="Available units"
                                value={formatMetric(stockLevel.availableUnits)}
                                accent
                              />
                            </div>

                            {rowError ? (
                              <div className="mt-4 rounded-[22px] border border-amber-400/25 bg-[linear-gradient(135deg,rgba(223,242,164,0.12),rgba(190,89,76,0.16))] px-4 py-3 text-sm text-[var(--foreground)]">
                                <p className="font-medium text-[var(--foreground)]">
                                  {rowError}
                                </p>
                              </div>
                            ) : null}
                          </div>

                          <div className="grid gap-3 sm:grid-cols-[110px_160px] xl:min-w-[296px]">
                            <div>
                              <label
                                className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-app-soft"
                                htmlFor={rowKey}
                              >
                                Quantity
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
                                disabled={pending || unavailable}
                                className="h-12 w-full rounded-2xl border border-app-soft bg-[var(--surface)] px-4 text-base text-[var(--foreground)] outline-none transition placeholder:text-app-soft focus:border-app-strong"
                              />
                            </div>

                            <div className="self-end">
                              <Button
                                className="w-full"
                                onClick={() =>
                                  void reserveInventory(product, stockLevel)
                                }
                                disabled={pending || unavailable}
                              >
                                {pending
                                  ? "Reserving..."
                                  : unavailable
                                    ? "Unavailable"
                                    : "Reserve"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </section>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-app-soft bg-app-veil p-5">
      <div className="flex items-center justify-between gap-3 text-app-soft">
        <p className="text-xs font-medium uppercase tracking-[0.18em]">
          {label}
        </p>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-app-soft bg-[var(--surface)]">
          {icon}
        </span>
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function ProductStatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-app-soft bg-app-veil px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-app-soft">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function WarehouseMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[20px] border px-4 py-3 ${
        accent
          ? "border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[linear-gradient(135deg,rgba(223,242,164,0.14),rgba(255,255,255,0.01))]"
          : "border-app-soft bg-[var(--surface)]"
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-app-soft">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}
