type ApiErrorPayload = {
  status: number;
  error: {
    code: string;
    message: string;
  };
};

export const insufficientStockErrorMessage =
  "Not enough stock available from this warehouse. You asked for more units than available. (Error 409)";

type InventorySummaryProduct = {
  stockLevels: {
    warehouse: {
      id: string;
    };
    totalUnits: number;
    reservedUnits: number;
    availableUnits: number;
  }[];
};

export type InventorySummary = {
  warehouseCount: number;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
};

export function getReserveErrorMessage(error: ApiErrorPayload | null) {
  if (!error) {
    return "Unable to reserve inventory right now.";
  }

  if (error.status === 409 && error.error.code === "NOT_ENOUGH_STOCK") {
    return insufficientStockErrorMessage;
  }

  return error.error.message || "Unable to reserve inventory right now.";
}

export function summarizeInventory(
  products: InventorySummaryProduct[],
): InventorySummary {
  const warehouses = new Set<string>();
  let totalUnits = 0;
  let reservedUnits = 0;
  let availableUnits = 0;

  for (const product of products) {
    for (const stockLevel of product.stockLevels) {
      warehouses.add(stockLevel.warehouse.id);
      totalUnits += stockLevel.totalUnits;
      reservedUnits += stockLevel.reservedUnits;
      availableUnits += stockLevel.availableUnits;
    }
  }

  return {
    warehouseCount: warehouses.size,
    totalUnits,
    reservedUnits,
    availableUnits,
  };
}
