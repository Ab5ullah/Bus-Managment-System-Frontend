"use client";

import React, { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Download, Loader2, QrCode, Receipt } from "lucide-react";
import { ApiException, getDefaultApiBaseUrl } from "@busms/api-client";
import { useAuth } from "@busms/api-client/auth";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  StatusBadge,
  formatCurrencyPkr,
} from "@busms/ui";
import { Link } from "@/i18n/routing";
import type { CreatedBookingSummary } from "./seat-booking-flow";

interface PaymentWithReceipt {
  id: string;
  status: string;
  gateway_name: string;
  gateway_reference: string;
  paid_at: string | null;
  receipt?: {
    receipt_number: string;
    gross_amount: string;
    discount_amount: string;
    tax_amount: string;
    service_fee: string;
    net_amount: string;
    currency: string;
    issued_at: string;
  } | null;
}

interface IssuedTicketItem {
  id: string;
  ticket_number: string;
  booking_pnr: string;
  seat_number: string;
  is_ladies_only: boolean;
  passenger_name: string;
  gender: string;
  from_terminal: string;
  to_terminal: string;
  trip_number: string;
  bus_registration: string;
  departure_datetime: string;
  status: string;
  qr_token: string;
  qr_data_uri: string;
}

export function CheckoutReturnClient() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const { getValidAccessToken } = useAuth();
  const baseUrl = getDefaultApiBaseUrl().replace(/\/$/, "");

  const paymentStatus = searchParams.get("payment_status") || "";
  const pnr = searchParams.get("pnr") || "";
  const sessionId = searchParams.get("session_id") || "";
  const receiptParam = searchParams.get("receipt") || "";

  const verifiedSessionRef = useRef(false);

  // Verify Stripe Checkout Session idempotently on mount when session_id is present
  useEffect(() => {
    if (!sessionId || paymentStatus !== "success" || verifiedSessionRef.current) return;
    verifiedSessionRef.current = true;
    void fetch(`${baseUrl}/api/payments/verify-stripe-session/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    }).catch(() => undefined);
  }, [sessionId, paymentStatus, baseUrl]);

  // Poll booking status every 2 seconds until CONFIRMED
  const bookingQuery = useQuery({
    queryKey: ["booking-return", pnr],
    queryFn: async () => {
      const token = await getValidAccessToken();
      const res = await fetch(`${baseUrl}/api/bookings/${encodeURIComponent(pnr)}/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new ApiException(json?.error?.message || "Booking not found.", res.status);
      }
      return json.data as CreatedBookingSummary;
    },
    enabled: Boolean(pnr && paymentStatus === "success"),
    refetchInterval: (query) => (query.state.data?.status === "CONFIRMED" ? false : 2000),
  });

  const isConfirmed = bookingQuery.data?.status === "CONFIRMED";

  const paymentsQuery = useQuery({
    queryKey: ["booking-payments", pnr],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/api/payments/booking/${encodeURIComponent(pnr)}/`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) return [] as PaymentWithReceipt[];
      return (json.data ?? []) as PaymentWithReceipt[];
    },
    enabled: Boolean(pnr && isConfirmed),
  });

  const ticketsQuery = useQuery({
    queryKey: ["booking-tickets", pnr],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/api/tickets/booking/${encodeURIComponent(pnr)}/`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) return [] as IssuedTicketItem[];
      return (json.data ?? []) as IssuedTicketItem[];
    },
    enabled: Boolean(pnr && isConfirmed),
  });

  const activeReceiptNumber =
    receiptParam ||
    paymentsQuery.data?.find((p) => p.status === "SUCCESS" && p.receipt)?.receipt
      ?.receipt_number ||
    "";

  const receiptQuery = useQuery({
    queryKey: ["payment-receipt", activeReceiptNumber],
    queryFn: async () => {
      const res = await fetch(
        `${baseUrl}/api/payments/receipt/${encodeURIComponent(activeReceiptNumber)}/`
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) return null;
      return json.data as NonNullable<PaymentWithReceipt["receipt"]>;
    },
    enabled: Boolean(activeReceiptNumber && isConfirmed),
  });

  if (!pnr) {
    return (
      <Alert variant="warning">
        Missing PNR parameter in payment return URL.
      </Alert>
    );
  }

  if (paymentStatus === "cancelled") {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="h-5 w-5" />
            <CardTitle>{t("payments.cancelledTitle")}</CardTitle>
          </div>
          <CardDescription>{t("payments.cancelledSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Link href={`/checkout/${encodeURIComponent(pnr)}`}>
            <Button>{t("payments.retryPayment")}</Button>
          </Link>
          <Link href="/search">
            <Button variant="outline">{t("common.back")}</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (bookingQuery.isLoading || !isConfirmed || !bookingQuery.data) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2.5 text-primary">
            <Loader2 className="h-5 w-5 animate-spin" />
            <CardTitle>{t("payments.verifyingTitle")}</CardTitle>
          </div>
          <CardDescription>{t("payments.verifyingSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>
            PNR: <strong className="font-mono text-foreground">{pnr}</strong> · Status:{" "}
            <span className="font-mono">{bookingQuery.data?.status ?? "CHECKING"}</span>
          </p>
          {bookingQuery.isError && (
            <Alert variant="danger">
              {(bookingQuery.error as Error)?.message || "Error polling booking status."}
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  const booking = bookingQuery.data;
  const receipt = receiptQuery.data;
  const tickets = ticketsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Confirmation Banner */}
      <Card className="border-emerald-200 dark:border-emerald-900/60">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
              <div>
                <CardTitle className="text-xl">{t("payments.confirmedTitle")}</CardTitle>
                <CardDescription>{t("payments.confirmedSubtitle")}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="neutral" className="font-mono text-xs">
                PNR {booking.pnr}
              </Badge>
              <StatusBadge status={booking.status} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 border-t pt-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Corridor</p>
            <p className="font-semibold">
              {booking.origin_city} → {booking.destination_city}
            </p>
            <p className="text-xs text-muted-foreground">
              {booking.origin_terminal} → {booking.destination_terminal}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Trip & Passenger</p>
            <p className="font-mono font-semibold">{booking.trip_number}</p>
            <p className="text-xs text-muted-foreground">
              {booking.passenger_name} · {booking.passenger_phone}
            </p>
          </div>
          <div className="sm:text-end">
            <p className="text-xs text-muted-foreground">Total Paid</p>
            <p className="font-mono text-lg font-semibold tabular-nums">
              {formatCurrencyPkr(booking.net_amount)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Receipt & Tickets Grid */}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Official Receipt */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-primary" />
              <span>{t("payments.receiptTitle")}</span>
            </CardTitle>
            {receipt && (
              <CardDescription className="font-mono text-xs">
                {t("payments.receiptNumber")}: {receipt.receipt_number}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {receiptQuery.isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("seatBooking.fareSubtotal")}</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrencyPkr(receipt?.gross_amount ?? booking.total_gross_fare)}
                  </span>
                </div>
                {Number(receipt?.discount_amount ?? booking.discount_amount) > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                    <span>{t("seatBooking.couponDiscount")}</span>
                    <span className="font-mono tabular-nums">
                      -{formatCurrencyPkr(receipt?.discount_amount ?? booking.discount_amount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("seatBooking.taxLabel")}</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrencyPkr(receipt?.tax_amount ?? booking.tax_amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("seatBooking.serviceFeeLabel")}</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrencyPkr(receipt?.service_fee ?? booking.service_fee)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2.5 font-semibold">
                  <span>{t("seatBooking.netPayable")}</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrencyPkr(receipt?.net_amount ?? booking.net_amount)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* QR Boarding Passes */}
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <QrCode className="h-4 w-4 text-primary" />
            <span>{t("payments.boardingPassesTitle")}</span>
          </h2>

          {ticketsQuery.isLoading ? (
            <Skeleton className="h-48" />
          ) : (
            tickets.map((ticket) => (
              <Card key={ticket.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="flex items-center gap-4">
                    {ticket.qr_data_uri && (
                      <img
                        src={ticket.qr_data_uri}
                        alt={`QR Boarding Pass ${ticket.ticket_number}`}
                        className="h-24 w-24 rounded-md border bg-white p-1"
                      />
                    )}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">
                          {ticket.ticket_number}
                        </span>
                        <StatusBadge status={ticket.status} />
                      </div>
                      <p className="text-sm font-medium">{ticket.passenger_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Seat <strong className="font-mono text-foreground">{ticket.seat_number}</strong> ·{" "}
                        {ticket.from_terminal} → {ticket.to_terminal}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {ticket.trip_number} · {ticket.bus_registration}
                      </p>
                    </div>
                  </div>

                  <a
                    href={`${baseUrl}/api/tickets/${encodeURIComponent(ticket.ticket_number)}/pdf/`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Download className="h-4 w-4" />
                      <span>{t("payments.downloadPdf")}</span>
                    </Button>
                  </a>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
