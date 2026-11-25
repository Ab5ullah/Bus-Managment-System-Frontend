"use client";

import React, { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Bus, Clock, Filter, MapPin, SlidersHorizontal } from "lucide-react";
import { BusType } from "@busms/config/constants";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  PaginationBar,
  formatCurrencyPkr,
} from "@busms/ui";
import { Link, useRouter } from "@/i18n/routing";
import { formatDuration, type TripSearchItem } from "@/lib/public-api";

interface SearchResultsClientProps {
  origin: string;
  destination: string;
  date: string;
  busType: string;
  departureWindow: string;
  maxPrice: string;
  sortBy: string;
  trips: TripSearchItem[];
  errorMessage: string | null;
}

function formatClock(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatShortDate(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("en-PK", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export function SearchResultsClient({
  origin,
  destination,
  date,
  busType,
  departureWindow,
  maxPrice,
  sortBy,
  trips,
  errorMessage,
}: SearchResultsClientProps) {
  const t = useTranslations();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [priceDraft, setPriceDraft] = useState(maxPrice);

  const pushFilters = (updates: Record<string, string>) => {
    const qs = new URLSearchParams();
    const merged: Record<string, string> = {
      origin,
      destination,
      date,
      bus_type: busType,
      departure_window: departureWindow,
      max_price: maxPrice,
      sort_by: sortBy || "departure_asc",
      ...updates,
    };

    for (const [k, v] of Object.entries(merged)) {
      if (v) qs.set(k, v);
    }
    setPage(1);
    router.push(`/search?${qs.toString()}`);
  };

  const totalCount = trips.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);

  const pagedTrips = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return trips.slice(start, start + pageSize);
  }, [trips, safePage, pageSize]);

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* Filter Sidebar */}
      <aside className="space-y-5 rounded-lg border bg-card p-4 h-fit">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Filter className="h-4 w-4 text-primary" />
            <span>{t("search.filters")}</span>
          </div>
          {(busType || departureWindow || maxPrice) && (
            <button
              type="button"
              onClick={() => {
                setPriceDraft("");
                pushFilters({ bus_type: "", departure_window: "", max_price: "" });
              }}
              className="text-xs font-medium text-primary hover:underline"
            >
              {t("common.reset")}
            </button>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("search.busType")}
          </Label>
          <div className="space-y-1.5">
            {[
              { value: "", label: t("common.all") },
              { value: BusType.STANDARD_AC, label: "Standard AC" },
              { value: BusType.EXECUTIVE, label: "Executive" },
              { value: BusType.SLEEPER, label: "Sleeper" },
              { value: BusType.LUXURY, label: "Luxury" },
            ].map((opt) => (
              <label key={opt.value || "all"} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="bus_type"
                  checked={busType === opt.value}
                  onChange={() => pushFilters({ bus_type: opt.value })}
                  className="accent-primary"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2 border-t pt-4">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("search.departureWindow")}
          </Label>
          <div className="space-y-1.5">
            {[
              { value: "", label: t("common.all") },
              { value: "morning", label: t("search.morning") },
              { value: "afternoon", label: t("search.afternoon") },
              { value: "night", label: t("search.night") },
            ].map((opt) => (
              <label key={opt.value || "any"} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="departure_window"
                  checked={departureWindow === opt.value}
                  onChange={() => pushFilters({ departure_window: opt.value })}
                  className="accent-primary"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="max-price" className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("search.maxPrice")}
          </Label>
          <div className="flex gap-2">
            <Input
              id="max-price"
              type="number"
              min={0}
              placeholder="e.g. 3000"
              value={priceDraft}
              onChange={(e) => setPriceDraft(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => pushFilters({ max_price: priceDraft })}
            >
              Apply
            </Button>
          </div>
        </div>
      </aside>

      {/* Results List */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
          <div>
            <h1 className="text-base font-semibold">
              {origin} → {destination}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t("search.resultsCount", { count: totalCount })}
              {date ? ` · ${date}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <select
              aria-label={t("search.sortBy")}
              value={sortBy || "departure_asc"}
              onChange={(e) => pushFilters({ sort_by: e.target.value })}
              className="h-9 rounded-md border border-input bg-card px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="departure_asc">{t("search.sortDepartureAsc")}</option>
              <option value="departure_desc">{t("search.sortDepartureDesc")}</option>
              <option value="price_asc">{t("search.sortPriceAsc")}</option>
              <option value="price_desc">{t("search.sortPriceDesc")}</option>
              <option value="duration_asc">{t("search.sortDurationAsc")}</option>
            </select>
          </div>
        </div>

        {errorMessage && <Alert variant="warning">{errorMessage}</Alert>}

        {!errorMessage && pagedTrips.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Bus className="mx-auto h-8 w-8 text-muted-foreground" />
              <h2 className="mt-3 text-base font-semibold">{t("search.noResultsTitle")}</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {t("search.noResultsDesc")}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => pushFilters({ date: "", bus_type: "", departure_window: "", max_price: "" })}
              >
                {t("common.reset")}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {pagedTrips.map((trip) => {
            const seatMapHref = `/trips/${trip.trip_id}/seats?from_stop=${encodeURIComponent(
              trip.segment_details.from_stop_id
            )}&to_stop=${encodeURIComponent(trip.segment_details.to_stop_id)}`;

            return (
              <Card key={trip.trip_id} className="transition-colors hover:border-primary/40">
                <CardContent className="p-5">
                  <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="default">{trip.bus.bus_type_display}</Badge>
                        <Badge variant="neutral" className="font-mono text-[11px]">
                          {trip.trip_number}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {trip.route.name}
                        </span>
                      </div>

                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                        <div>
                          <p className="font-mono text-xl font-semibold tabular-nums">
                            {formatClock(trip.origin.departure_time)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatShortDate(trip.origin.departure_time)}
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-xs font-medium">
                            <MapPin className="h-3 w-3 text-primary" />
                            <span>{trip.origin.terminal_name}</span>
                          </p>
                        </div>

                        <div className="flex flex-col items-center text-center">
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                            <Clock className="h-3 w-3" />
                            {formatDuration(trip.segment_details.duration_minutes)}
                          </span>
                          <div className="my-1.5 h-px w-20 bg-border sm:w-28" />
                          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                            {Math.round(Number(trip.segment_details.distance_km))} km
                          </span>
                        </div>

                        <div className="text-end">
                          <p className="font-mono text-xl font-semibold tabular-nums">
                            {formatClock(trip.destination.arrival_time)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatShortDate(trip.destination.arrival_time)}
                          </p>
                          <p className="mt-1 text-xs font-medium">
                            {trip.destination.terminal_name}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-row items-center justify-between gap-4 border-t pt-4 md:flex-col md:items-end md:border-s md:border-t-0 md:ps-6 md:pt-0">
                      <div className="text-start md:text-end">
                        <p className="font-mono text-xl font-semibold text-foreground tabular-nums">
                          {formatCurrencyPkr(trip.fare.amount)}
                        </p>
                        <p className="mt-0.5 text-xs">
                          {trip.availability.is_sold_out ? (
                            <span className="font-medium text-destructive">{t("common.soldOut")}</span>
                          ) : (
                            <span className="font-medium text-emerald-700 dark:text-emerald-400">
                              {t("common.seatsLeft", { count: trip.availability.available_seats })}
                            </span>
                          )}
                        </p>
                      </div>

                      <Link href={seatMapHref}>
                        <Button disabled={trip.availability.is_sold_out}>
                          {t("search.selectSeats")}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {totalCount > 0 && (
          <PaginationBar
            currentPage={safePage}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(1);
            }}
          />
        )}
      </div>
    </div>
  );
}
