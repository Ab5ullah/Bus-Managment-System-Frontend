"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, History, Loader2, X } from "lucide-react";
import {
  ApiException,
  API_ENDPOINTS,
  extractApiErrorMessage,
  getDefaultApiBaseUrl,
} from "@busms/api-client";
import { useAuth } from "@busms/api-client/auth";
import {
  Alert,
  Badge,
  Button,
  Input,
  Label,
  Skeleton,
  StatusBadge,
  formatCurrencyPkr,
} from "@busms/ui";
import type { CreatedBookingSummary } from "./seat-booking-flow";

export interface BookingRecord extends CreatedBookingSummary {
  seats: Array<{
    id: string;
    seat_id: string;
    seat_number: string;
    passenger_name: string;
    gender: string;
    price: string;
    status?: string;
  }>;
}

interface RefundEstimate {
  booking_pnr: string;
  is_pending: boolean;
  seats_count: number;
  is_partial?: boolean;
  hours_to_departure: number;
  policy_name: string;
  refund_percentage: string | number;
  gross_fare_refunded: string | number;
  tax_refunded: string | number;
  cancellation_fee_charged: string | number;
  net_refund_amount: string | number;
  non_refundable_service_fee?: string | number;
}

interface RefundAuditItem {
  id: string;
  refund_number: string;
  policy_name: string | null;
  seat_numbers: string[];
  gross_fare_refunded: string;
  tax_refunded: string;
  cancellation_fee_charged: string;
  net_refund_amount: string;
  status: string;
  is_operator_cancellation: boolean;
  reason: string;
  processed_at: string;
}

export function CancellationDrawer({
  booking,
  onClose,
  onCancelled,
}: {
  booking: BookingRecord | null;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { getValidAccessToken } = useAuth();
  const baseUrl = getDefaultApiBaseUrl().replace(/\/$/, "");

  const activeSeats = useMemo(
    () =>
      (booking?.seats ?? []).filter(
        (s) => !s.status || s.status === "BOOKED" || s.status === "LOCKED"
      ),
    [booking]
  );

  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (booking) {
      setSelectedSeatIds(activeSeats.map((s) => s.id));
      setReason("");
      setSubmitError(null);
      setSubmitSuccess(null);
    }
  }, [booking, activeSeats]);

  const canCancel =
    Boolean(booking) &&
    ["PENDING", "CONFIRMED", "PARTIALLY_CANCELLED"].includes(booking?.status ?? "") &&
    activeSeats.length > 0;

  const isPartialSelection =
    selectedSeatIds.length > 0 && selectedSeatIds.length < activeSeats.length;

  const estimateQuery = useQuery({
    queryKey: ["refund-estimate", booking?.pnr, selectedSeatIds],
    queryFn: async () => {
      if (!booking) return null;
      const res = await fetch(`${baseUrl}${API_ENDPOINTS.CANCELLATIONS.ESTIMATE}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pnr: booking.pnr,
          seat_ids: isPartialSelection ? selectedSeatIds : [],
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new ApiException(
          extractApiErrorMessage(json, "Unable to estimate refund."),
          res.status
        );
      }
      return json.data as RefundEstimate;
    },
    enabled: Boolean(booking && canCancel && selectedSeatIds.length > 0),
  });

  const refundsQuery = useQuery({
    queryKey: ["booking-refunds", booking?.pnr],
    queryFn: async () => {
      if (!booking) return [] as RefundAuditItem[];
      const res = await fetch(
        `${baseUrl}${API_ENDPOINTS.CANCELLATIONS.refunds(booking.pnr)}`
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) return [] as RefundAuditItem[];
      return (json.data?.refunds ?? []) as RefundAuditItem[];
    },
    enabled: Boolean(booking),
  });

  if (!booking) return null;

  const toggleSeat = (bookingSeatId: string) => {
    setSelectedSeatIds((prev) =>
      prev.includes(bookingSeatId)
        ? prev.filter((id) => id !== bookingSeatId)
        : [...prev, bookingSeatId]
    );
  };

  const handleConfirmCancellation = async () => {
    if (!canCancel || selectedSeatIds.length === 0) return;
    setSubmitError(null);
    setSubmitSuccess(null);
    setIsSubmitting(true);

    try {
      const token = await getValidAccessToken();
      const endpoint = isPartialSelection
        ? `${baseUrl}${API_ENDPOINTS.CANCELLATIONS.CANCEL_SEATS}`
        : `${baseUrl}${API_ENDPOINTS.CANCELLATIONS.CANCEL_BOOKING}`;

      const payload = isPartialSelection
        ? { pnr: booking.pnr, seat_ids: selectedSeatIds, reason }
        : { pnr: booking.pnr, reason };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new ApiException(
          extractApiErrorMessage(json, "Cancellation failed."),
          res.status
        );
      }

      setSubmitSuccess(json.message || "Cancellation processed.");
      await queryClient.invalidateQueries({ queryKey: ["booking-refunds", booking.pnr] });
      onCancelled();
    } catch (err) {
      setSubmitError(err instanceof ApiException ? err.message : "Cancellation failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const estimate = estimateQuery.data;
  const refunds = refundsQuery.data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("cancellation.drawerTitle")}
        className="flex h-full w-full max-w-lg flex-col border-s bg-card shadow-elevated"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">{t("cancellation.drawerTitle")}</h2>
            <p className="font-mono text-xs text-muted-foreground">
              PNR {booking.pnr} · {booking.origin_city} → {booking.destination_city}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("common.close")}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {submitError && <Alert variant="danger">{submitError}</Alert>}
          {submitSuccess && <Alert variant="success">{submitSuccess}</Alert>}

          {canCancel ? (
            <>
              <div className="space-y-2.5">
                <Label className="text-xs text-muted-foreground">
                  {t("cancellation.selectSeatsPrompt")}
                </Label>
                <div className="space-y-2">
                  {activeSeats.map((s) => (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center justify-between rounded-md border bg-background px-3 py-2.5 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedSeatIds.includes(s.id)}
                          onChange={() => toggleSeat(s.id)}
                          className="h-4 w-4 accent-primary"
                        />
                        <div>
                          <span className="font-mono font-semibold">Seat {s.seat_number}</span>
                          <span className="ms-2 text-xs text-muted-foreground">
                            {s.passenger_name}
                          </span>
                        </div>
                      </div>
                      <span className="font-mono text-xs tabular-nums">
                        {formatCurrencyPkr(s.price)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Refund Estimate Breakdown */}
              <div className="rounded-lg border bg-muted/40 p-4 space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("cancellation.policyTier")}
                  </span>
                  {estimate && (
                    <Badge variant="info">
                      {estimate.policy_name} ({Number(estimate.refund_percentage)}%)
                    </Badge>
                  )}
                </div>

                {estimateQuery.isLoading ? (
                  <Skeleton className="h-24" />
                ) : estimateQuery.isError ? (
                  <Alert variant="warning">
                    {(estimateQuery.error as Error)?.message || "Unable to estimate refund."}
                  </Alert>
                ) : estimate ? (
                  <div className="space-y-1.5 border-t pt-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hours until departure</span>
                      <span className="font-mono tabular-nums">{estimate.hours_to_departure}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gross Fare Refunded</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrencyPkr(estimate.gross_fare_refunded)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax Refunded</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrencyPkr(estimate.tax_refunded)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cancellation Deduction</span>
                      <span className="font-mono text-rose-600 tabular-nums">
                        -{formatCurrencyPkr(estimate.cancellation_fee_charged)}
                      </span>
                    </div>
                    {estimate.non_refundable_service_fee !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t("cancellation.nonRefundableFee")}
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatCurrencyPkr(estimate.non_refundable_service_fee)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-2 text-sm font-semibold">
                      <span>{t("cancellation.netRefund")}</span>
                      <span className="font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {formatCurrencyPkr(estimate.net_refund_amount)}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cancel-reason">{t("cancellation.reasonLabel")}</Label>
                <Input
                  id="cancel-reason"
                  placeholder="Schedule change"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <Button
                type="button"
                variant="destructive"
                className="w-full gap-2"
                disabled={isSubmitting || selectedSeatIds.length === 0 || estimateQuery.isError}
                onClick={handleConfirmCancellation}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <span>
                  {isPartialSelection
                    ? t("cancellation.confirmPartial")
                    : t("cancellation.confirmFull")}
                </span>
              </Button>
            </>
          ) : (
            <Alert variant="neutral">
              This booking is currently <strong className="font-mono">{booking.status}</strong> and has no active seats eligible for cancellation.
            </Alert>
          )}

          {/* Refund Audit History */}
          <div className="space-y-3 border-t pt-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4 text-primary" />
              <span>{t("cancellation.refundHistory")}</span>
            </h3>

            {refundsQuery.isLoading ? (
              <Skeleton className="h-20" />
            ) : refunds.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("cancellation.noRefunds")}</p>
            ) : (
              <div className="space-y-2.5">
                {refunds.map((r) => (
                  <div key={r.id} className="rounded-md border bg-background p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold">{r.refund_number}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Seats: {r.seat_numbers.join(", ") || "All"}</span>
                      <span className="font-mono font-semibold text-foreground tabular-nums">
                        {formatCurrencyPkr(r.net_refund_amount)}
                      </span>
                    </div>
                    {r.policy_name && (
                      <p className="text-[11px] text-muted-foreground">{r.policy_name}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
