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
    <header className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <div className="surface-card-strong flex items-center justify-between gap-4 rounded-[34px] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/"
            className="group inline-flex min-w-0 items-center gap-3 rounded-full pr-1 transition hover:opacity-90"
            aria-label="Go back to inventory"
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-app-soft bg-[linear-gradient(135deg,rgba(223,242,164,0.2),rgba(222,129,99,0.14))] text-[var(--foreground)] shadow-[0_14px_40px_rgba(0,0,0,0.14)]">
              <Layers3 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.24em] text-app-soft">
                Allo
              </p>
              <p className="truncate text-sm font-semibold text-[var(--foreground)] sm:text-[15px]">
                Inventory Reservations
              </p>
            </div>
          </Link>

          {currentPath === "reservation" ? (
            <Link
              href="/"
              className="hidden items-center gap-2 rounded-full border border-app-soft bg-app-veil px-3 py-2 text-xs font-medium text-app-muted transition hover:border-app-strong hover:text-[var(--foreground)] md:inline-flex"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to inventory
            </Link>
          ) : null}

          <div className="hidden items-center gap-1.5 rounded-full border border-app-soft bg-[var(--surface-veil)] p-1 lg:flex">
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] transition ${
                currentPath === "inventory"
                  ? "accent-pill shadow-[0_8px_24px_color-mix(in_srgb,var(--accent)_14%,transparent)]"
                  : "text-app-soft"
              }`}
            >
              Inventory
            </span>
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] transition ${
                currentPath === "reservation"
                  ? "accent-pill shadow-[0_8px_24px_color-mix(in_srgb,var(--accent)_14%,transparent)]"
                  : "text-app-soft"
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
