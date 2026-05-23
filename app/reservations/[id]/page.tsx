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
    <main className="min-h-screen bg-[linear-gradient(180deg,_#f8fafc_0%,_#eef2f7_100%)] px-6 py-16 text-slate-950 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-3xl rounded-md border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
          Reservation created
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          Reservation ready for checkout confirmation.
        </h1>
        <p className="mt-5 text-sm text-slate-600">Reservation ID</p>
        <p className="mt-2 rounded-md bg-slate-950 px-4 py-3 font-mono text-sm text-white">
          {id}
        </p>
        <p className="mt-6 max-w-2xl text-base leading-7 text-slate-650">
          The next step is the confirmation and release flow. This placeholder
          page is here so the reserve action has a real destination while that
          checkout behavior is still being built.
        </p>
      </div>
    </main>
  );
}
