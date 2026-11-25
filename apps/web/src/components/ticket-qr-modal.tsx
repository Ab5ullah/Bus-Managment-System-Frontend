"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Download, QrCode, X } from "lucide-react";
import { API_ENDPOINTS, getDefaultApiBaseUrl } from "@busms/api-client";
import { Alert, Button, Skeleton, StatusBadge } from "@busms/ui";

interface TicketItem {
  id: string;
  ticket_number: string;
  booking_pnr: string;
  seat_number: string;
  passenger_name: string;
  from_terminal: string;
  to_terminal: string;
  trip_number: string;
  bus_registration: string;
  status: string;
  qr_data_uri: string;
}

export function TicketQrModal({
  pnr,
  onClose,
}: {
  pnr: string | null;
  onClose: () => void;
}) {
  const t = useTranslations();
  const baseUrl = getDefaultApiBaseUrl().replace(/\/$/, "");

  const ticketsQuery = useQuery({
    queryKey: ["account-tickets", pnr],
    queryFn: async () => {
      if (!pnr) return [] as TicketItem[];
      const res = await fetch(`${baseUrl}${API_ENDPOINTS.TICKETS.byBooking(pnr)}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) return [] as TicketItem[];
      return (json.data ?? []) as TicketItem[];
    },
    enabled: Boolean(pnr),
  });

  if (!pnr) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Tickets for ${pnr}`}
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border bg-card shadow-elevated"
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">
              {t("payments.boardingPassesTitle")} — <span className="font-mono">{pnr}</span>
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("common.close")}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3 p-5">
          {ticketsQuery.isLoading ? (
            <Skeleton className="h-36" />
          ) : (ticketsQuery.data ?? []).length === 0 ? (
            <Alert variant="neutral">
              No issued QR tickets found for PNR {pnr}. Tickets are generated once payment is confirmed.
            </Alert>
          ) : (
            ticketsQuery.data!.map((ticket) => (
              <div
                key={ticket.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-background p-4"
              >
                <div className="flex items-center gap-4">
                  {ticket.qr_data_uri && (
                    <img
                      src={ticket.qr_data_uri}
                      alt={`QR ${ticket.ticket_number}`}
                      className="h-24 w-24 rounded border bg-white p-1"
                    />
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{ticket.ticket_number}</span>
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
                  href={`${baseUrl}${API_ENDPOINTS.TICKETS.pdf(ticket.ticket_number)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Download className="h-4 w-4" />
                    <span>{t("payments.downloadPdf")}</span>
                  </Button>
                </a>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
