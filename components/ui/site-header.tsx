import { Layers3, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/ui/theme-toggle";

type SiteHeaderProps = {
  currentPath?: "inventory" | "reservation";
};

export function SiteHeader({
  currentPath = "inventory",
}: SiteHeaderProps) {
  return (
    <header className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <div className="surface-card-strong flex items-center justify-between gap-4 rounded-[30px] px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/"
            className="group inline-flex min-w-0 items-center gap-3"
            aria-label="Go back to inventory"
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-app-soft bg-[linear-gradient(135deg,rgba(223,242,164,0.18),rgba(222,129,99,0.14))] text-[var(--foreground)]">
              <Layers3 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.24em] text-app-soft">
                Allo
              </p>
              <p className="truncate text-sm font-semibold text-[var(--foreground)] sm:text-base">
                Inventory Reservations
              </p>
            </div>
          </Link>

          <div className="hidden items-center gap-2 lg:flex">
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.18em] ${
                currentPath === "inventory"
                  ? "accent-pill"
                  : "border-app-soft text-app-soft"
              }`}
            >
              Inventory
            </span>
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.18em] ${
                currentPath === "reservation"
                  ? "accent-pill"
                  : "border-app-soft text-app-soft"
              }`}
            >
              Checkout hold
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-app-soft bg-app-veil px-3 py-2 text-xs text-app-muted sm:inline-flex">
            <ShieldCheck className="h-4 w-4 text-[var(--accent-strong)]" aria-hidden="true" />
            Concurrency-safe checkout holds
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
