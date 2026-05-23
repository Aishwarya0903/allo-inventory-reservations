import { Clock3, Database, GitBranch, Warehouse } from "lucide-react";

const principles = [
  {
    title: "Warehouse-aware availability",
    description:
      "Stock will be evaluated at the product and warehouse level so checkout does not hide real supply in other locations.",
    icon: Warehouse,
  },
  {
    title: "Short-lived checkout holds",
    description:
      "Pending reservations make units unavailable only while payment is in progress, then confirm or release cleanly.",
    icon: Clock3,
  },
  {
    title: "Concurrency-first writes",
    description:
      "The reservation path is planned around Postgres transactions and atomic conditional stock updates.",
    icon: GitBranch,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-[58vh] max-w-6xl flex-col justify-center px-6 py-16 sm:px-8 lg:px-10">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800">
              <Database className="h-4 w-4" aria-hidden="true" />
              Foundation for Allo inventory reservations
            </div>
            <h1 className="text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
              Multi-warehouse checkout reservations that protect the last unit.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
              This scaffold sets up the app shell for temporary checkout holds:
              reserve while payment is active, confirm on success, and release
              on failure or expiry.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-6 py-10 sm:px-8 md:grid-cols-3 lg:px-10">
        {principles.map((principle) => {
          const Icon = principle.icon;

          return (
            <article
              key={principle.title}
              className="rounded-md border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-md bg-slate-900 text-white">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="text-base font-semibold text-slate-950">
                {principle.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {principle.description}
              </p>
            </article>
          );
        })}
      </section>
    </main>
  );
}
