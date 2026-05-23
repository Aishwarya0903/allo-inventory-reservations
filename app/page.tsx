import { InventoryBrowser } from "@/components/inventory/inventory-browser";

export default function Home() {
  const reservationTtlMinutes = Number(
    process.env.RESERVATION_TTL_MINUTES ?? 10,
  );

  return <InventoryBrowser reservationTtlMinutes={reservationTtlMinutes} />;
}
