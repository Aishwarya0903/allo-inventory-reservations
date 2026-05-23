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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(203,213,225,0.35),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f7_100%)] px-6 py-12 text-slate-950 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <ReservationCheckout reservationId={id} />
      </div>
    </main>
  );
}
