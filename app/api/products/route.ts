import { jsonError, jsonData } from "@/lib/api/responses";
import { cleanupExpiredReservations } from "@/lib/domain/reservation-service";
import { calculateAvailableStock } from "@/lib/domain/reservations";
import { prisma as db } from "@/lib/db/prisma";

export async function GET() {
  try {
    await cleanupExpiredReservations(db);

    const products = await db.product.findMany({
      orderBy: { sku: "asc" },
      include: {
        stockLevels: {
          orderBy: {
            warehouse: {
              code: "asc",
            },
          },
          include: {
            warehouse: true,
          },
        },
      },
    });

    return jsonData({
      products: products.map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        imageUrl: product.imageUrl,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        stockLevels: product.stockLevels.map((stockLevel) => ({
          id: stockLevel.id,
          warehouse: {
            id: stockLevel.warehouse.id,
            code: stockLevel.warehouse.code,
            name: stockLevel.warehouse.name,
            city: stockLevel.warehouse.city,
          },
          totalUnits: stockLevel.totalUnits,
          reservedUnits: stockLevel.reservedUnits,
          availableUnits: calculateAvailableStock({
            totalUnits: stockLevel.totalUnits,
            reservedUnits: stockLevel.reservedUnits,
          }),
        })),
      })),
    });
  } catch {
    return jsonError(
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to load products.",
    );
  }
}
