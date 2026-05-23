import { ReservationCheckout } from "@/components/reservations/reservation-checkout";

type ReservationDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ReservationDetailPage({
  params,
}: ReservationDetailPageProps) {
  const { id } = await params;

  return <ReservationCheckout reservationId={id} />;
}
