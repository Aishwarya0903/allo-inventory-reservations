import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const products = [
  {
    sku: "ALLO-ELECTROLYTE-CITRUS-30",
    name: "Citrus Electrolyte Sticks",
    description:
      "Thirty-count box of citrus electrolyte drink sticks for daily hydration.",
    imageUrl: null,
  },
  {
    sku: "ALLO-SLEEP-GUMMIES-BERRY-60",
    name: "Berry Sleep Gummies",
    description:
      "Sixty-count bottle of berry sleep support gummies for nightly routines.",
    imageUrl: null,
  },
  {
    sku: "ALLO-TRAVEL-TUMBLER-24OZ",
    name: "Insulated Travel Tumbler",
    description:
      "Twenty-four ounce stainless tumbler for retail bundles and D2C orders.",
    imageUrl: null,
  },
  {
    sku: "ALLO-COMPRESSION-SOCKS-M",
    name: "Compression Crew Socks",
    description:
      "Medium compression crew socks stocked for wellness and recovery kits.",
    imageUrl: null,
  },
];

const warehouses = [
  {
    code: "AUS-01",
    name: "Austin Central Fulfillment",
    city: "Austin",
  },
  {
    code: "PHX-01",
    name: "Phoenix West Fulfillment",
    city: "Phoenix",
  },
  {
    code: "RDU-01",
    name: "Raleigh East Fulfillment",
    city: "Raleigh",
  },
];

const stockBySkuAndWarehouse = [
  {
    sku: "ALLO-ELECTROLYTE-CITRUS-30",
    warehouseCode: "AUS-01",
    totalUnits: 120,
    reservedUnits: 8,
  },
  {
    sku: "ALLO-ELECTROLYTE-CITRUS-30",
    warehouseCode: "PHX-01",
    totalUnits: 80,
    reservedUnits: 3,
  },
  {
    sku: "ALLO-SLEEP-GUMMIES-BERRY-60",
    warehouseCode: "AUS-01",
    totalUnits: 55,
    reservedUnits: 5,
  },
  {
    sku: "ALLO-SLEEP-GUMMIES-BERRY-60",
    warehouseCode: "RDU-01",
    totalUnits: 70,
    reservedUnits: 6,
  },
  {
    sku: "ALLO-TRAVEL-TUMBLER-24OZ",
    warehouseCode: "PHX-01",
    totalUnits: 34,
    reservedUnits: 2,
  },
  {
    sku: "ALLO-TRAVEL-TUMBLER-24OZ",
    warehouseCode: "RDU-01",
    totalUnits: 26,
    reservedUnits: 0,
  },
  {
    sku: "ALLO-COMPRESSION-SOCKS-M",
    warehouseCode: "AUS-01",
    totalUnits: 90,
    reservedUnits: 12,
  },
  {
    sku: "ALLO-COMPRESSION-SOCKS-M",
    warehouseCode: "PHX-01",
    totalUnits: 45,
    reservedUnits: 4,
  },
];

async function main() {
  const productRecords = new Map<string, { id: string }>();
  const warehouseRecords = new Map<string, { id: string }>();

  for (const product of products) {
    const record = await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        description: product.description,
        imageUrl: product.imageUrl,
      },
      create: product,
      select: { id: true },
    });

    productRecords.set(product.sku, record);
  }

  for (const warehouse of warehouses) {
    const record = await prisma.warehouse.upsert({
      where: { code: warehouse.code },
      update: {
        name: warehouse.name,
        city: warehouse.city,
      },
      create: warehouse,
      select: { id: true },
    });

    warehouseRecords.set(warehouse.code, record);
  }

  for (const stock of stockBySkuAndWarehouse) {
    const product = productRecords.get(stock.sku);
    const warehouse = warehouseRecords.get(stock.warehouseCode);

    if (!product || !warehouse) {
      throw new Error(
        `Missing seed reference for ${stock.sku} at ${stock.warehouseCode}`,
      );
    }

    await prisma.stockLevel.upsert({
      where: {
        productId_warehouseId: {
          productId: product.id,
          warehouseId: warehouse.id,
        },
      },
      update: {
        totalUnits: stock.totalUnits,
        reservedUnits: stock.reservedUnits,
      },
      create: {
        productId: product.id,
        warehouseId: warehouse.id,
        totalUnits: stock.totalUnits,
        reservedUnits: stock.reservedUnits,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
