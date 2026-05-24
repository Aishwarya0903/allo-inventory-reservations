"use client";

import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  Layers3,
  MapPin,
  RefreshCw,
  Store,
  Warehouse,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/ui/site-header";
import {
  formatReservationCountdown,
  getReservationActionErrorMessage,
  isPendingReservationExpired,
  parseReservationDetailResponse,
  type ReservationCheckoutDetail,
} from "@/lib/ui/reservation-checkout";

type ApiError = {
  error: {
    code: string;
    message: string;
  };
};

type ReservationCheckoutProps = {
  reservationId: string;
};

type ActionState = "confirm" | "release" | null;

function formatTimestamp(timestamp: string | null) {
  if (!timestamp) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function getStatusTone(status: ReservationCheckoutDetail["status"]) {
  switch (status) {
    case "confirmed":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-500";
    case "released":
      return "border-amber-500/25 bg-amber-500/10 text-amber-500";
    case "pending":
    default:
      return "border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--foreground)]";
  }
}

function getStatusLabel(status: ReservationCheckoutDetail["status"]) {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "released":
      return "Released";
    case "pending":
    default:
      return "Pending hold";
  }
}

export function ReservationCheckout({
  reservationId,
}: ReservationCheckoutProps) {
  const [reservation, setReservation] =
    useState<ReservationCheckoutDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ActionState>(null);
  const [now, setNow] = useState(Date.now());
  const [expiredOnRead, setExpiredOnRead] = useState(false);
  const didRefreshExpiredReservation = useRef(false);

  const loadReservation = useCallback(
    async (options?: { background?: boolean }) => {
      const background = options?.background ?? false;

      if (!background) {
        setIsLoading(true);
      }

      setPageError(null);

      try {
        const response = await fetch(`/api/reservations/${reservationId}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          const failure = await parseApiFailure(response);
          setPageError(getReservationActionErrorMessage("load", failure));
          setReservation(null);
          setExpiredOnRead(false);
          return;
        }

        const payload = parseReservationDetailResponse(await response.json());

        if (!payload) {
          setPageError("Reservation details are unavailable for this hold.");
          setReservation(null);
          setExpiredOnRead(false);
          return;
        }

        setReservation(payload.reservation);
        setExpiredOnRead(payload.expiredOnRead);
        didRefreshExpiredReservation.current = false;
      } catch {
        setPageError(getReservationActionErrorMessage("load", null));
        setReservation(null);
        setExpiredOnRead(false);
      } finally {
        if (!background) {
          setIsLoading(false);
        }
      }
    },
    [reservationId],
  );

  useEffect(() => {
    void loadReservation();
  }, [loadReservation]);

  useEffect(() => {
    if (!reservation || reservation.status !== "pending") {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [reservation]);

  const isExpired = useMemo(() => {
    if (!reservation) {
      return false;
    }

    return isPendingReservationExpired(
      reservation.status,
      reservation.expiresAt,
      now,
    );
  }, [now, reservation]);

  useEffect(() => {
    if (!reservation || !isExpired || didRefreshExpiredReservation.current) {
      return;
    }

    didRefreshExpiredReservation.current = true;
    setActionError("Reservation expired.");
    void loadReservation({ background: true });
  }, [isExpired, loadReservation, reservation]);

  async function runAction(action: Exclude<ActionState, null>) {
    setActiveAction(action);
    setActionError(null);

    try {
      const response = await fetch(
        `/api/reservations/${reservationId}/${action}`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const failure = await parseApiFailure(response);
        setActionError(getReservationActionErrorMessage(action, failure));

        if (
          response.status === 404 ||
          response.status === 410 ||
          response.status === 409
        ) {
          await loadReservation({ background: true });
        }

        return;
      }

      await loadReservation({ background: true });
    } catch {
      setActionError(getReservationActionErrorMessage(action, null));
    } finally {
      setActiveAction(null);
    }
  }

  if (isLoading) {
    return (
      <main className="relative min-h-screen overflow-hidden pb-16 text-[var(--foreground)]">
        <SiteHeader currentPath="reservation" />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="cinematic-panel rounded-[34px] p-7 sm:p-9">
            <div className="h-4 w-32 animate-pulse rounded-full bg-white/10" />
            <div className="mt-5 h-14 w-72 animate-pulse rounded-full bg-white/10" />
            <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="h-72 animate-pulse rounded-[24px] border border-app-soft bg-app-veil" />
              <div className="h-72 animate-pulse rounded-[24px] border border-app-soft bg-app-veil" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (pageError) {
    return (
      <main className="relative min-h-screen overflow-hidden pb-16 text-[var(--foreground)]">
        <SiteHeader currentPath="reservation" />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="cinematic-panel rounded-[34px] p-7 sm:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-soft">
              Reservation unavailable
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
              {pageError}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-app-muted sm:text-base">
              The reservation detail could not be loaded from the API. If the hold
              was just created, return to the inventory surface and retry the flow
              after the latest product data refreshes.
            </p>
            <div className="mt-8">
              <Button asChild variant="outline">
                <Link href="/">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to inventory
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!reservation) {
    return null;
  }

  const countdown = formatReservationCountdown(reservation.expiresAt, now);
  const pending = reservation.status === "pending" && !isExpired;
  const expiredPending = reservation.status === "pending" && isExpired;
  const nearExpiry =
    pending && new Date(reservation.expiresAt).getTime() - now <= 60_000;
  const disableActions = activeAction !== null || !pending;
  const confirmedAt = formatTimestamp(reservation.confirmedAt);
  const releasedAt = formatTimestamp(reservation.releasedAt);
  const expiresAt = formatTimestamp(reservation.expiresAt);
  const heroCopy =
    reservation.status === "confirmed"
      ? {
          title: "Purchase confirmed.",
          body: "The hold has been committed and stock was permanently adjusted for this checkout.",
        }
      : reservation.status === "released"
        ? {
            title: "Hold released.",
            body: "The reservation is closed and the units are available for checkout allocation again.",
          }
        : expiredPending
          ? {
              title: "Reservation expired.",
              body: "This hold reached its expiry window before confirmation could complete.",
            }
          : {
              title: "Checkout hold is active.",
              body: "Confirm on payment success, or cancel the hold to release units back to the warehouse pool.",
            };

  return (
    <main className="relative min-h-screen overflow-hidden pb-16 text-[var(--foreground)]">
      <SiteHeader currentPath="reservation" />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="cinematic-panel rounded-[34px]">
          <div className="grid gap-6 border-b border-app-soft px-6 py-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:px-9 lg:py-9">
            <div className="max-w-4xl">
              <div className="mb-5">
                <Button asChild variant="outline" size="sm">
                  <Link href="/">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back to inventory
                  </Link>
                </Button>
              </div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-app-soft">
                Checkout hold
              </p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-[var(--foreground)] sm:text-5xl">
                {heroCopy.title}
              </h1>
              <p className="mt-5 max-w-3xl text-sm leading-7 text-app-muted sm:text-base">
                {heroCopy.body}
              </p>
            </div>

            <div
              className={`inline-flex rounded-full border px-3.5 py-1.5 text-sm font-semibold ${getStatusTone(
                reservation.status,
              )}`}
            >
              {getStatusLabel(reservation.status)}
            </div>
          </div>

          <div className="grid gap-5 px-6 py-6 sm:px-8 lg:grid-cols-[minmax(0,1.08fr)_340px] lg:px-9 lg:py-7">
            <div className="grid gap-5">
              <div className="glass-row rounded-[26px] p-5">
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-[18px] border border-app-soft bg-[linear-gradient(135deg,rgba(223,242,164,0.16),rgba(255,255,255,0.03))] text-[var(--foreground)]">
                    <Store className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-app-soft">
                      Product
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                      {reservation.product.name}
                    </h2>
                    <p className="mt-2 font-mono text-sm text-app-soft">
                      {reservation.product.sku}
                    </p>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-app-muted">
                      {reservation.product.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="glass-row rounded-[26px] p-5">
                  <div className="flex items-start gap-4">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-app-soft bg-app-veil text-[var(--foreground)]">
                      <Warehouse className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-app-soft">
                        Warehouse
                      </p>
                      <p className="mt-3 text-xl font-semibold text-[var(--foreground)]">
                        {reservation.warehouse.name}
                      </p>
                      <p className="mt-2 inline-flex items-center gap-2 text-sm text-app-muted">
                        <MapPin className="h-4 w-4" aria-hidden="true" />
                        {reservation.warehouse.code} ·{" "}
                        {reservation.warehouse.city}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="glass-row rounded-[26px] p-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-app-soft">
                    Hold details
                  </p>
                  <dl className="mt-4 grid gap-3 text-sm text-app-muted">
                    <div className="flex items-start justify-between gap-4 rounded-2xl border border-app-soft bg-app-veil px-4 py-3">
                      <dt>Reservation ID</dt>
                      <dd className="font-mono text-right text-xs text-[var(--foreground)]">
                        {reservation.id}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-app-soft bg-app-veil px-4 py-3">
                      <dt>Quantity</dt>
                      <dd className="font-semibold text-[var(--foreground)]">
                        {reservation.quantity}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-app-soft bg-app-veil px-4 py-3">
                      <dt>Expires at</dt>
                      <dd className="text-[var(--foreground)]">{expiresAt}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>

            <aside className="surface-card rounded-[28px] border border-app-strong bg-[linear-gradient(180deg,var(--surface-strong)_0%,color-mix(in_srgb,var(--surface-strong)_90%,black_10%)_100%)] p-5">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-app-soft">
                <Clock3
                  className="h-4 w-4 text-[var(--accent-strong)]"
                  aria-hidden="true"
                />
                Hold status
              </div>

              {pending ? (
                <>
                  <div
                    className={`mt-5 rounded-[24px] border p-5 ${
                      nearExpiry
                        ? "border-amber-400/35 bg-[linear-gradient(135deg,rgba(251,191,36,0.16),rgba(223,242,164,0.08))]"
                        : "border-[color-mix(in_srgb,var(--accent)_34%,transparent)] bg-[linear-gradient(135deg,rgba(223,242,164,0.16),rgba(255,255,255,0.03))]"
                    }`}
                  >
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-app-soft">
                      Time remaining
                    </p>
                    <p className="mt-3 font-mono text-4xl font-semibold tracking-tight text-[var(--foreground)]">
                      {countdown}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-app-muted">
                      {nearExpiry
                        ? "This hold is close to expiry. Confirm the purchase now or let the hold release automatically."
                        : "Confirming now converts the held units into a completed stock decrement. If the timer reaches zero first, the hold will be released automatically."}
                    </p>
                  </div>
                </>
              ) : null}

              {reservation.status === "confirmed" ? (
                <>
                <div className="mt-5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                    <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <p className="mt-4 text-2xl font-semibold text-[var(--foreground)]">
                    Purchase confirmed
                  </p>
                  <p className="mt-3 text-sm leading-6 text-app-muted">
                    Total and reserved stock were permanently adjusted for this
                    successful checkout. This hold is final.
                  </p>
                  {confirmedAt ? (
                    <p className="mt-4 inline-flex items-center gap-2 text-sm text-app-soft">
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Confirmed at {confirmedAt}
                    </p>
                  ) : null}
                </>
              ) : null}

              {reservation.status === "released" ? (
                <>
                <div className="mt-5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
                    <XCircle className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <p className="mt-4 text-2xl font-semibold text-[var(--foreground)]">
                    Hold released
                  </p>
                  <p className="mt-3 text-sm leading-6 text-app-muted">
                    This hold is no longer active. Reserved units have been
                    returned to the warehouse inventory pool.
                  </p>
                  {releasedAt ? (
                    <p className="mt-4 inline-flex items-center gap-2 text-sm text-app-soft">
                      <Layers3 className="h-4 w-4" aria-hidden="true" />
                      Released at {releasedAt}
                    </p>
                  ) : null}
                </>
              ) : null}

              {expiredPending ? (
                <>
                  <div className="mt-5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
                    <XCircle className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <p className="mt-4 text-2xl font-semibold text-[var(--foreground)]">
                    Reservation expired
                  </p>
                  <p className="mt-3 text-sm leading-6 text-app-muted">
                    Reservation expired before confirmation could complete. The
                    hold will be released and inventory will return to the
                    warehouse pool.
                  </p>
                </>
              ) : null}

              {actionError ? (
                <div className="mt-6 rounded-[20px] border border-amber-400/30 bg-[linear-gradient(135deg,rgba(223,242,164,0.1),rgba(190,89,76,0.14))] px-4 py-3 text-sm font-medium text-[var(--foreground)]">
                  {actionError}
                </div>
              ) : null}

              {expiredOnRead ? (
                <div className="mt-6 rounded-[20px] border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-[var(--foreground)]">
                  Reservation expired before confirmation could complete. The
                  hold was released automatically when this page opened.
                </div>
              ) : null}

              {!pending && !actionError ? (
                <div className="mt-6 rounded-[20px] border border-app-soft bg-app-veil px-4 py-3 text-sm text-app-muted">
                  This hold is no longer active. Return to inventory to create a
                  new reservation.
                </div>
              ) : null}

              <div className="mt-8 grid gap-3">
                <Button
                  onClick={() => void runAction("confirm")}
                  disabled={disableActions}
                  className="w-full"
                  size="lg"
                >
                  {activeAction === "confirm" ? (
                    <RefreshCw
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  Confirm purchase
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void runAction("release")}
                  disabled={disableActions}
                  className="w-full"
                  size="lg"
                >
                  {activeAction === "release" ? (
                    <RefreshCw
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                  )}
                  Cancel hold
                </Button>
              </div>

              <div className="mt-6">
                <Button asChild variant="ghost" className="w-full">
                  <Link href="/">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Return to inventory
                  </Link>
                </Button>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

async function parseApiFailure(
  response: Response,
): Promise<{ status: number; error?: ApiError["error"] } | null> {
  try {
    const body = (await response.json()) as ApiError;
    return {
      status: response.status,
      error: body.error,
    };
  } catch {
    return {
      status: response.status,
    };
  }
}
