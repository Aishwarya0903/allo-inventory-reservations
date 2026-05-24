import { ArrowLeft, Layers3, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/ui/theme-toggle";

type SiteHeaderProps = {
  currentPath?: "inventory" | "reservation";
};

export function SiteHeader({
  currentPath = "inventory",
}: SiteHeaderProps) {
  return (
    <header className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8 lg:pt-5">
      <div className="surface-card-strong flex items-center justify-between gap-3 rounded-[30px] px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="group inline-flex min-w-0 items-center gap-2.5 rounded-full pr-1 transition hover:opacity-90"
            aria-label="Go back to inventory"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-app-soft bg-[linear-gradient(135deg,rgba(223,242,164,0.18),rgba(255,255,255,0.04))] text-[var(--foreground)]">
              <Layers3 className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-medium uppercase tracking-[0.18em] text-app-soft">
                Allo
              </p>
              <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                Inventory Reservations
              </p>
            </div>
          </Link>

          {currentPath === "reservation" ? (
            <Link
              href="/"
              className="hidden items-center gap-2 rounded-full border border-app-soft bg-app-veil px-3 py-1.5 text-xs font-medium text-app-muted transition hover:border-app-strong hover:text-[var(--foreground)] md:inline-flex"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to inventory
            </Link>
          ) : null}

          <div className="hidden items-center gap-1 rounded-full border border-app-soft bg-[var(--surface-veil)] p-0.5 lg:flex">
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                currentPath === "inventory"
                  ? "accent-pill"
                  : "text-app-soft"
              }`}
            >
              Inventory
            </span>
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                currentPath === "reservation"
                  ? "accent-pill"
                  : "text-app-soft"
              }`}
            >
              Checkout hold
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-app-soft bg-app-veil px-3 py-1.5 text-xs text-app-muted sm:inline-flex">
            <ShieldCheck className="h-4 w-4 text-[var(--accent-strong)]" aria-hidden="true" />
            Concurrency-safe
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
