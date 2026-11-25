"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  RotateCcw,
  Search,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  FileText,
  Clock,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  Label,
  Skeleton,
  StatusBadge,
  formatCurrencyPkr,
} from "@busms/ui";
import { useAuth } from "@busms/api-client/auth";
import { API_ENDPOINTS } from "@busms/config/endpoints";
import { adminFetch, formatShortDateTime } from "@/lib/admin-api";

interface BookingSeatItem {
  id: string;
  seat_id: string;
  seat_number: string;
  passenger_name: string;
  fare: string;
  status: string;
}

interface BookingDetail {
  pnr: string;
  status: string;
  contact_name: string;
  contact_phone: string;
  total_amount: string;
  net_payable: string;
  departure_datetime?: string;
  seats: BookingSeatItem[];
}

interface RefundEstimate {
  pnr: string;
  policy_tier: string;
  gross_amount: string;
  cancellation_fee: string;
  non_refundable_service_fee: string;
  net_refund_amount: string;
}

interface RefundRecord {
  id: string;
  seat_numbers: string[];
  net_refund_amount: string;
  status: string;
  is_operator_cancellation: boolean;
  reason: string;
  processed_at: string;
}

interface CancellationPolicy {
  id: string;
  name: string;
  min_hours_before_departure: number;
  refund_percentage: string;
  description?: string;
}

interface TripCancelResult {
  trip_id: string;
  bookings_cancelled_count: number;
  total_refunded_amount?: string;
}

export function CancellationsClient() {
  const t = useTranslations();
  const { getValidAccessToken: getToken } = useAuth();

  // PNR lookup & refund state
  const [pnrInput, setPnrInput] = useState("");
  const [activePnr, setActivePnr] = useState("");
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [cancelReason, setCancelReason] = useState("");
  const [estimate, setEstimate] = useState<RefundEstimate | null>(null);
  const [pnrError, setPnrError] = useState("");
  const [pnrSuccess, setPnrSuccess] = useState("");

  // Operator trip cancellation state
  const [tripId, setTripId] = useState("");
  const [tripReason, setTripReason] = useState("");
  const [tripResult, setTripResult] = useState<TripCancelResult | null>(null);
  const [tripError, setTripError] = useState("");

  // Policies query
  const policiesQuery = useQuery({
    queryKey: ["cancellation-policies"],
    queryFn: () =>
      adminFetch<CancellationPolicy[] | { results: CancellationPolicy[] }>(
        API_ENDPOINTS.CANCELLATIONS.POLICIES,
        getToken
      ),
  });

  const policies: CancellationPolicy[] = Array.isArray(policiesQuery.data)
    ? policiesQuery.data
    : policiesQuery.data?.results ?? [];

  // Booking detail query
  const bookingQuery = useQuery({
    queryKey: ["admin-booking", activePnr],
    queryFn: () =>
      adminFetch<BookingDetail>(API_ENDPOINTS.BOOKINGS.detail(activePnr), getToken),
    enabled: !!activePnr,
    retry: false,
  });

  // Refunds audit query
  const refundsQuery = useQuery({
    queryKey: ["admin-booking-refunds", activePnr],
    queryFn: () =>
      adminFetch<{ refunds: RefundRecord[] }>(
        API_ENDPOINTS.CANCELLATIONS.refunds(activePnr),
        getToken
      ),
    enabled: !!activePnr,
    retry: false,
  });

  const handleLookup = () => {
    const clean = pnrInput.trim().toUpperCase();
    if (!clean) return;
    setActivePnr(clean);
    setSelectedSeatIds([]);
    setEstimate(null);
    setPnrError("");
    setPnrSuccess("");
  };

  const estimateMutation = useMutation({
    mutationFn: () =>
      adminFetch<RefundEstimate>(API_ENDPOINTS.CANCELLATIONS.ESTIMATE, getToken, {
        method: "POST",
        body: JSON.stringify({
          pnr: activePnr,
          seat_ids: selectedSeatIds,
        }),
      }),
    onSuccess: (data) => {
      setEstimate(data);
      setPnrError("");
    },
    onError: (err: Error) => {
      setEstimate(null);
      setPnrError(err.message);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => {
      if (selectedSeatIds.length > 0) {
        return adminFetch(API_ENDPOINTS.CANCELLATIONS.CANCEL_SEATS, getToken, {
          method: "POST",
          body: JSON.stringify({
            pnr: activePnr,
            seat_ids: selectedSeatIds,
            reason: cancelReason,
          }),
        });
      }
      return adminFetch(API_ENDPOINTS.CANCELLATIONS.CANCEL_BOOKING, getToken, {
        method: "POST",
        body: JSON.stringify({
          pnr: activePnr,
          reason: cancelReason,
        }),
      });
    },
    onSuccess: () => {
      setPnrSuccess(t("adminCancel.cancelSuccess"));
      setEstimate(null);
      setSelectedSeatIds([]);
      setCancelReason("");
      bookingQuery.refetch();
      refundsQuery.refetch();
    },
    onError: (err: Error) => setPnrError(err.message),
  });

  const tripCancelMutation = useMutation({
    mutationFn: () =>
      adminFetch<TripCancelResult>(
        API_ENDPOINTS.CANCELLATIONS.OPERATOR_CANCEL_TRIP,
        getToken,
        {
          method: "POST",
          body: JSON.stringify({
            trip_id: tripId.trim(),
            reason: tripReason,
          }),
        }
      ),
    onSuccess: (data) => {
      setTripResult(data);
      setTripError("");
      setTripId("");
      setTripReason("");
    },
    onError: (err: Error) => {
      setTripResult(null);
      setTripError(err.message);
    },
  });

  const toggleSeat = (seatId: string) => {
    setSelectedSeatIds((prev) =>
      prev.includes(seatId) ? prev.filter((id) => id !== seatId) : [...prev, seatId]
    );
    setEstimate(null);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("adminCancel.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("adminCancel.subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 columns: PNR Lookup & Refund Processing */}
        <div className="space-y-5 lg:col-span-2">
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <RotateCcw className="h-4 w-4 text-primary" />
              {t("adminCancel.pnrLookupTitle")}
            </h2>
            <div className="flex gap-3">
              <Input
                value={pnrInput}
                onChange={(e) => setPnrInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                placeholder={t("account.pnrLookupPlaceholder")}
                className="font-mono uppercase"
              />
              <Button onClick={handleLookup} disabled={!pnrInput.trim()}>
                <Search className="me-2 h-4 w-4" />
                {t("account.lookupCta")}
              </Button>
            </div>
          </Card>

          {pnrError && (
            <Alert variant="danger">
              <span>{pnrError}</span>
            </Alert>
          )}
          {pnrSuccess && (
            <Alert variant="success">
              <CheckCircle2 className="inline h-4 w-4 text-green-600" />
              <span className="ms-2">{pnrSuccess}</span>
            </Alert>
          )}

          {bookingQuery.isLoading && <Skeleton className="h-48 w-full" />}

          {bookingQuery.isError && (
            <Alert variant="danger">
              <span>{(bookingQuery.error as Error).message}</span>
            </Alert>
          )}

          {bookingQuery.data && (
            <Card className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                <div>
                  <p className="font-mono text-lg font-bold">{bookingQuery.data.pnr}</p>
                  <p className="text-xs text-muted-foreground">
                    {bookingQuery.data.contact_name} · {bookingQuery.data.contact_phone}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">
                    {formatCurrencyPkr(
                      Number(bookingQuery.data.net_payable ?? bookingQuery.data.total_amount ?? 0)
                    )}
                  </span>
                  <StatusBadge status={bookingQuery.data.status} />
                </div>
              </div>

              {bookingQuery.data.seats && bookingQuery.data.seats.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">{t("cancellation.selectSeatsPrompt")}</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {bookingQuery.data.seats.map((s) => {
                      const seatKey = s.seat_id || s.id;
                      const checked = selectedSeatIds.includes(seatKey);
                      const isCancelled = s.status === "CANCELLED";
                      return (
                        <label
                          key={s.id}
                          className={`flex cursor-pointer items-center justify-between rounded-md border p-3 text-sm ${
                            isCancelled
                              ? "opacity-50"
                              : checked
                              ? "border-primary bg-primary/5"
                              : "hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              disabled={isCancelled}
                              checked={checked}
                              onChange={() => toggleSeat(seatKey)}
                              className="h-4 w-4 rounded"
                            />
                            <div>
                              <p className="font-medium">
                                {t("pos.seat")} {s.seat_number}
                              </p>
                              <p className="text-xs text-muted-foreground">{s.passenger_name}</p>
                            </div>
                          </div>
                          <StatusBadge status={s.status} />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>{t("cancellation.reasonLabel")}</Label>
                <Input
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={t("adminCancel.reasonPlaceholder")}
                />
              </div>

              {estimate && (
                <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("cancellation.policyTier")}</span>
                    <Badge variant="neutral">{estimate.policy_tier}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("cancellation.nonRefundableFee")}</span>
                    <span>{formatCurrencyPkr(Number(estimate.non_refundable_service_fee ?? 0))}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 font-bold">
                    <span>{t("cancellation.netRefund")}</span>
                    <span className="text-green-600">
                      {formatCurrencyPkr(Number(estimate.net_refund_amount ?? 0))}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => estimateMutation.mutate()}
                  disabled={estimateMutation.isPending}
                >
                  {estimateMutation.isPending ? t("common.loading") : t("adminCancel.estimateRefund")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm(t("adminCancel.confirmCancelPrompt"))) {
                      cancelMutation.mutate();
                    }
                  }}
                  disabled={
                    cancelMutation.isPending ||
                    bookingQuery.data.status === "CANCELLED"
                  }
                >
                  {selectedSeatIds.length > 0
                    ? t("cancellation.confirmPartial")
                    : t("cancellation.confirmFull")}
                </Button>
              </div>
            </Card>
          )}

          {/* Refund audit records */}
          {activePnr && (
            <Card className="p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {t("cancellation.refundHistory")}
              </h3>
              {refundsQuery.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : refundsQuery.data?.refunds?.length ? (
                <div className="space-y-2">
                  {refundsQuery.data.refunds.map((ref) => (
                    <div
                      key={ref.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {formatCurrencyPkr(Number(ref.net_refund_amount))}{" "}
                          {ref.is_operator_cancellation && (
                            <Badge variant="warning" className="ms-1 text-[10px]">
                              {t("adminCancel.operatorOverride")}
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("pos.seat")}: {ref.seat_numbers.join(", ") || "All"} ·{" "}
                          {ref.reason || "—"}
                        </p>
                      </div>
                      <div className="text-end">
                        <StatusBadge status={ref.status} />
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {formatShortDateTime(ref.processed_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("cancellation.noRefunds")}</p>
              )}
            </Card>
          )}
        </div>

        {/* Right column: Operator Bulk Trip Cancellation & Policy Catalog */}
        <div className="space-y-5">
          <Card className="border-destructive/30 p-5 space-y-4">
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              <h2 className="font-semibold">{t("adminCancel.operatorTripCancelTitle")}</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("adminCancel.operatorTripCancelDesc")}
            </p>

            {tripError && (
              <Alert variant="danger">
                <span>{tripError}</span>
              </Alert>
            )}
            {tripResult && (
              <Alert className="border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="ms-2 text-xs">
                  {t("adminCancel.tripCancelledSummary", {
                    count: tripResult.bookings_cancelled_count,
                  })}
                </span>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label>{t("scanner.tripId")} *</Label>
              <Input
                value={tripId}
                onChange={(e) => setTripId(e.target.value)}
                placeholder={t("scanner.tripIdPlaceholder")}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("cancellation.reasonLabel")}</Label>
              <Input
                value={tripReason}
                onChange={(e) => setTripReason(e.target.value)}
                placeholder={t("adminCancel.tripReasonPlaceholder")}
              />
            </div>
            <Button
              variant="destructive"
              className="w-full"
              disabled={!tripId.trim() || tripCancelMutation.isPending}
              onClick={() => {
                if (confirm(t("adminCancel.confirmTripCancelPrompt"))) {
                  tripCancelMutation.mutate();
                }
              }}
            >
              <AlertTriangle className="me-2 h-4 w-4" />
              {tripCancelMutation.isPending
                ? t("common.loading")
                : t("adminCancel.executeTripCancel")}
            </Button>
          </Card>

          <Card className="p-5 space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4 text-primary" />
              {t("adminCancel.policyCatalog")}
            </h3>
            {policiesQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : policies.length > 0 ? (
              <div className="space-y-2">
                {policies.map((p) => (
                  <div key={p.id} className="rounded-md border bg-muted/30 p-3 text-xs">
                    <div className="flex items-center justify-between font-semibold">
                      <span>{p.name}</span>
                      <Badge variant="info">{p.refund_percentage}%</Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      ≥ {p.min_hours_before_departure}h {t("adminCancel.beforeDeparture")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("adminCancel.noPolicies")}</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
