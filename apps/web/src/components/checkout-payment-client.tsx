"use client";

import React, { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CreditCard, ShieldCheck, Ticket } from "lucide-react";
import { ApiException, API_ENDPOINTS, getDefaultApiBaseUrl } from "@busms/api-client";
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
  LockCountdown,
  Skeleton,
  StatusBadge,
  formatCurrencyPkr,
} from "@busms/ui";
import { Link, useRouter } from "@/i18n/routing";
import type { CreatedBookingSummary } from "./seat-booking-flow";

interface InitiatePaymentResponse {
  payment: {
    id: string;
    booking_pnr: string;
    amount: string;
    currency: string;
    status: string;
    gateway_name: string;
  };
  gateway: {
    success: boolean;
    already_confirmed?: boolean;
    checkout_url?: string;
    gateway_reference?: string;
  };
}

export function CheckoutPaymentClient({ pnr }: { pnr: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { getValidAccessToken } = useAuth();
  const baseUrl = getDefaultApiBaseUrl().replace(/\/$/, "");

  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isInitiating, setIsInitiating] = useState(false);

  const bookingQuery = useQuery({
    queryKey: ["booking-detail", pnr],
    queryFn: async () => {
      const token = await getValidAccessToken();
      const res = await fetch(`${baseUrl}${API_ENDPOINTS.BOOKINGS.detail(pnr)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new ApiException(
          json?.error?.message || "Booking not found.",
          res.status,
          json?.error?.code || "NOT_FOUND"
        );
      }
      return json.data as CreatedBookingSummary;
    },
  });

  const handleInitiate = async (gatewayName: "stripe" | "mock") => {
    setPaymentError(null);
    setIsInitiating(true);
    try {
      const token = await getValidAccessToken();
      const returnUrl = `${window.location.origin}/${locale}/checkout/return`;
      const res = await fetch(`${baseUrl}${API_ENDPOINTS.PAYMENTS.INITIATE}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          pnr,
          method: gatewayName === "stripe" ? "STRIPE" : "CARD_ONLINE",
          gateway_name: gatewayName,
          checkout_mode: "checkout_session",
          return_url: returnUrl,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new ApiException(
          json?.error?.message || "Unable to initiate payment.",
          res.status,
          json?.error?.code || "PAYMENT_INIT_FAILED"
        );
      }

      const payload = json.data as InitiatePaymentResponse;

      if (payload.gateway.already_confirmed) {
        router.replace(`/checkout/return?payment_status=success&pnr=${encodeURIComponent(pnr)}`);
        return;
      }

      if (gatewayName === "stripe" && payload.gateway.checkout_url?.startsWith("http")) {
        window.location.assign(payload.gateway.checkout_url);
        return;
      }

      if (gatewayName === "mock") {
        const confirmRes = await fetch(`${baseUrl}${API_ENDPOINTS.PAYMENTS.CONFIRM_MOCK}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment_id: payload.payment.id,
            status: "SUCCESS",
          }),
        });
        const confirmJson = await confirmRes.json().catch(() => null);
        if (!confirmRes.ok || !confirmJson?.success) {
          throw new ApiException(
            confirmJson?.error?.message || "Sandbox payment failed.",
            confirmRes.status
          );
        }
        const receiptNumber = confirmJson.data?.receipt?.receipt_number || "";
        router.replace(
          `/checkout/return?payment_status=success&pnr=${encodeURIComponent(pnr)}&receipt=${encodeURIComponent(
            receiptNumber
          )}`
        );
        return;
      }

      throw new ApiException("Gateway did not return a checkout URL.", 502);
    } catch (err) {
      setPaymentError(
        err instanceof ApiException ? err.message : "Payment initiation failed. Please try again."
      );
      setIsInitiating(false);
    }
  };

  if (bookingQuery.isLoading) {
    return <Skeleton className="mx-auto h-96 max-w-2xl" />;
  }

  if (bookingQuery.isError || !bookingQuery.data) {
    return (
      <Alert variant="danger">
        {(bookingQuery.error as Error)?.message || "Could not retrieve reservation."}
      </Alert>
    );
  }

  const booking = bookingQuery.data;

  if (booking.status === "CONFIRMED") {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>Booking {booking.pnr} is already confirmed</CardTitle>
          <CardDescription>View your official receipt and QR boarding passes.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={`/checkout/return?payment_status=success&pnr=${encodeURIComponent(booking.pnr)}`}>
            <Button>View Boarding Passes</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/search"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        <span>{t("common.back")}</span>
      </Link>

      <Card className="shadow-elevated">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-xl">{t("payments.checkoutTitle")}</CardTitle>
              <CardDescription>{t("payments.checkoutSubtitle")}</CardDescription>
            </div>
            <StatusBadge status={booking.status} />
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {paymentError && <Alert variant="danger">{paymentError}</Alert>}

          {booking.expires_at && (
            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-2.5 text-xs">
              <span>Reservation hold remaining</span>
              <LockCountdown lockedUntil={booking.expires_at} />
            </div>
          )}

          <div className="rounded-lg border p-4 space-y-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-primary" />
                <span className="font-semibold">
                  {booking.origin_city} → {booking.destination_city}
                </span>
              </div>
              <Badge variant="neutral" className="font-mono">
                PNR {booking.pnr}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {booking.origin_terminal} → {booking.destination_terminal} · {booking.trip_number}
            </p>
            <div className="border-t pt-2 space-y-1">
              {booking.seats.map((s) => (
                <div key={s.id} className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    Seat <strong className="font-mono text-foreground">{s.seat_number}</strong> ·{" "}
                    {s.passenger_name}
                  </span>
                  <span className="font-mono tabular-nums">{formatCurrencyPkr(s.price)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("seatBooking.fareSubtotal")}</span>
              <span className="font-mono tabular-nums">
                {formatCurrencyPkr(booking.total_gross_fare)}
              </span>
            </div>
            {Number(booking.discount_amount) > 0 && (
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <span>{t("seatBooking.couponDiscount")}</span>
                <span className="font-mono tabular-nums">
                  -{formatCurrencyPkr(booking.discount_amount)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("seatBooking.taxLabel")}</span>
              <span className="font-mono tabular-nums">{formatCurrencyPkr(booking.tax_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("seatBooking.serviceFeeLabel")}</span>
              <span className="font-mono tabular-nums">{formatCurrencyPkr(booking.service_fee)}</span>
            </div>
            <div className="flex justify-between border-t pt-2.5 text-base font-semibold">
              <span>{t("seatBooking.netPayable")}</span>
              <span className="font-mono tabular-nums">{formatCurrencyPkr(booking.net_amount)}</span>
            </div>
          </div>

          <div className="space-y-2.5">
            <Button
              type="button"
              className="w-full gap-2"
              disabled={isInitiating || booking.status !== "PENDING"}
              onClick={() => handleInitiate("stripe")}
            >
              <CreditCard className="h-4 w-4" />
              <span>
                {isInitiating ? t("payments.redirectingStripe") : t("payments.payWithStripe")}
              </span>
            </Button>

            {process.env.NODE_ENV !== "production" && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isInitiating || booking.status !== "PENDING"}
                onClick={() => handleInitiate("mock")}
              >
                {t("payments.payWithSandbox")}
              </Button>
            )}
          </div>

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Webhook-authoritative settlement · Idempotent PNR confirmation</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
