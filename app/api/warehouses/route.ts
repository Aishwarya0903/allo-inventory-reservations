import { jsonError, jsonData } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: { code: "asc" },
    });

    return jsonData({ warehouses });
  } catch {
    return jsonError(
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to load warehouses.",
    );
  }
}
