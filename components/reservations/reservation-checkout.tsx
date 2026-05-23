"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Store,
  Warehouse,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  formatReservationCountdown,
  getReservationActionErrorMessage,
  isPendingReservationExpired,
} from "@/lib/ui/reservation-checkout";

type ReservationApiResponse = {
  reservation: ReservationDetail;
  expiredOnRead: boolean;
};

type ReservationMutationResponse = {
  reservation: ReservationDetail;
};

type ReservationDetail = {
  id: string;
  quantity: number;
  status: "pending" | "confirmed" | "released";
  expiresAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    sku: string;
    name: string;
    description: string;
  };
  warehouse: {
    id: string;
    code: string;
    name: string;
    city: string;
  };
};

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

function getStatusTone(status: ReservationDetail["status"]) {
  switch (status) {
    case "confirmed":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "released":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "pending":
    default:
      return "border-sky-200 bg-sky-50 text-sky-800";
  }
}

function getStatusLabel(status: ReservationDetail["status"]) {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "released":
      return "Released";
    case "pending":
    default:
      return "Pending";
  }
}

export function ReservationCheckout({
  reservationId,
}: ReservationCheckoutProps) {
  const [reservation, setReservation] = useState<ReservationDetail | null>(null);
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

        const data = (await response.json()) as ReservationApiResponse;
        setReservation(data.reservation);
        setExpiredOnRead(data.expiredOnRead);
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

    return isPendingReservationExpired(reservation.status, reservation.expiresAt, now);
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
      const response = await fetch(`/api/reservations/${reservationId}/${action}`, {
        method: "POST",
      });

      if (!response.ok) {
        const failure = await parseApiFailure(response);
        setActionError(getReservationActionErrorMessage(action, failure));

        if (response.status === 404 || response.status === 410 || response.status === 409) {
          await loadReservation({ background: true });
        }

        return;
      }

      const data = (await response.json()) as ReservationMutationResponse;
      setReservation(data.reservation);
      setExpiredOnRead(false);
    } catch {
      setActionError(getReservationActionErrorMessage(action, null));
    } finally {
      setActiveAction(null);
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-8 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-10 w-80 animate-pulse rounded bg-slate-100" />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="h-28 animate-pulse rounded bg-slate-100" />
          <div className="h-28 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-8 text-rose-900 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-700">
          Reservation unavailable
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {pageError}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-rose-800">
          The reservation detail could not be loaded from the API. If the hold
          was just created, refresh the product listing and try again.
        </p>
        <div className="mt-6">
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to inventory
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!reservation) {
    return null;
  }

  const countdown = formatReservationCountdown(reservation.expiresAt, now);
  const pending = reservation.status === "pending" && !isExpired;
  const disableActions = activeAction !== null || !pending;
  const confirmedAt = formatTimestamp(reservation.confirmedAt);
  const releasedAt = formatTimestamp(reservation.releasedAt);
  const expiresAt = formatTimestamp(reservation.expiresAt);

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="mb-4">
                <Button asChild variant="outline" size="sm">
                  <Link href="/">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back to inventory
                  </Link>
                </Button>
              </div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
                Checkout hold
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Complete the reservation before the hold expires.
              </h1>
              <p className="mt-4 text-base leading-7 text-slate-650">
                This screen represents the short reservation window between
                stock allocation and payment completion. Confirming the hold
                finalizes inventory. Cancelling releases it back to the
                warehouse pool.
              </p>
            </div>
            <div
              className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${getStatusTone(
                reservation.status,
              )}`}
            >
              {getStatusLabel(reservation.status)}
            </div>
          </div>
        </div>

        <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="grid gap-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-slate-900 text-white">
                  <Store className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">
                    Product
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">
                    {reservation.product.name}
                  </h2>
                  <p className="mt-1 font-mono text-sm text-slate-500">
                    {reservation.product.sku}
                  </p>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-650">
                    {reservation.product.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                  <Warehouse className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">
                      Warehouse
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {reservation.warehouse.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {reservation.warehouse.code} · {reservation.warehouse.city}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">
                      Hold details
                    </p>
                    <dl className="mt-2 grid gap-2 text-sm text-slate-700">
                      <div className="flex justify-between gap-4">
                        <dt>Reservation ID</dt>
                        <dd className="font-mono text-xs text-slate-500">
                          {reservation.id}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Quantity</dt>
                        <dd className="font-semibold text-slate-950">
                          {reservation.quantity}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Expires at</dt>
                        <dd>{expiresAt}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-md border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.16em] text-slate-300">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              Hold status
            </div>

            {pending ? (
              <>
                <p className="mt-5 font-mono text-5xl font-semibold tracking-tight">
                  {countdown}
                </p>
                <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                  Time remaining
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  This reservation remains active until the timer reaches zero.
                  Confirming now converts the held units into a completed stock
                  decrement.
                </p>
              </>
            ) : null}

            {reservation.status === "confirmed" ? (
              <>
                <div className="mt-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                  <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="mt-4 text-2xl font-semibold">Reservation confirmed</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Inventory has been committed for checkout completion. The hold
                  is final and no longer actionable from this screen.
                </p>
                {confirmedAt ? (
                  <p className="mt-4 text-sm text-slate-400">
                    Confirmed at {confirmedAt}
                  </p>
                ) : null}
              </>
            ) : null}

            {reservation.status === "released" ? (
              <>
                <div className="mt-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
                  <XCircle className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="mt-4 text-2xl font-semibold">Reservation released</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  This hold is no longer active. The reserved units are back in
                  the warehouse inventory pool.
                </p>
                {releasedAt ? (
                  <p className="mt-4 text-sm text-slate-400">
                    Released at {releasedAt}
                  </p>
                ) : null}
              </>
            ) : null}

            {actionError ? (
              <div className="mt-6 rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {actionError}
              </div>
            ) : null}

            {expiredOnRead ? (
              <div className="mt-6 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                This reservation expired and was released automatically when the
                checkout hold page was opened.
              </div>
            ) : null}

            {!pending && !actionError ? (
              <div className="mt-6 rounded-md border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">
                This hold is no longer active. Return to inventory to create a
                new reservation.
              </div>
            ) : null}

            <div className="mt-8 grid gap-3">
              <Button
                onClick={() => void runAction("confirm")}
                disabled={disableActions}
                className="bg-white text-slate-950 hover:bg-slate-100"
              >
                {activeAction === "confirm" ? (
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                )}
                Confirm purchase
              </Button>
              <Button
                variant="outline"
                onClick={() => void runAction("release")}
                disabled={disableActions}
                className="border-slate-700 bg-transparent text-white hover:bg-slate-900"
              >
                {activeAction === "release" ? (
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                )}
                Cancel reservation
              </Button>
            </div>

            <div className="mt-6">
              <Button
                asChild
                variant="outline"
                className="border-slate-700 bg-transparent text-white hover:bg-slate-900"
              >
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
