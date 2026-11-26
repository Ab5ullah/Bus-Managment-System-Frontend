"use client";

import React, { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bus,
  Search,
  MapPin,
  Clock,
  Users,
  Printer,
  CheckCircle,
  Banknote,
  CreditCard,
  ArrowRight,
  User,
  Phone,
  IdCard,
  X,
  RefreshCcw,
} from "lucide-react";
import {
  SeatMap,
  LockCountdown,
  StatusBadge,
  PaginationBar,
  Button,
  Card,
  Input,
  Label,
  Skeleton,
  Alert,
  Badge,
  formatCurrencyPkr,
} from "@busms/ui";
import { useAuth } from "@busms/api-client/auth";
import { normalizePaginated, type PaginatedData } from "@busms/api-client";
import { API_ENDPOINTS } from "@busms/config/endpoints";
import { adminFetch, formatShortDateTime } from "@/lib/admin-api";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TripResult {
  trip_id: string;
  trip_number: string;
  status: string;
  route: { id?: string; code: string; name: string };
  origin: {
    terminal_id?: string;
    terminal_name: string;
    city: string;
    departure_time: string;
  };
  destination: {
    terminal_id?: string;
    terminal_name: string;
    city: string;
    arrival_time: string;
  };
  segment_details?: {
    from_stop_id: string;
    to_stop_id: string;
    distance_km: string;
    duration_minutes: number;
  };
  bus: {
    registration_number: string;
    bus_type: string;
    bus_type_display?: string;
    total_seats: number;
  };
  fare: {
    amount: string;
    currency: string;
  };
  availability: {
    available_seats: number;
    total_seats: number;
    is_sold_out: boolean;
  };
}

interface TripSearchApiResponse {
  total_results: number;
  page: number;
  page_size: number;
  trips: TripResult[];
}

interface SeatInfo {
  id: string;
  seat_number: string;
  row: number;
  column?: number;
  col?: number;
  deck: number;
  seat_type?: string;
  is_ladies_only: boolean;
  is_active?: boolean;
  status: string;
  fare?: string | number;
  is_available?: boolean;
  occupied_gender?: string | null;
  female_adjacent_restricted?: boolean;
  allowed_genders?: string[];
}

interface SeatLock {
  lock_token: string;
  locked_seats: Array<string | { seat_id: string }>;
  locked_until?: string;
  expires_at?: string;
  expires_in_seconds?: number;
}

interface PassengerForm {
  full_name: string;
  phone: string;
  cnic_or_id: string;
  is_female: boolean;
}

interface BookingResult {
  pnr: string;
  id: string;
  total_amount?: string;
  net_amount?: string;
  status: string;
}

interface TicketInfo {
  ticket_number: string;
  seat_number: string;
  passenger_name: string;
  qr_code_base64: string;
}

// ─── Step enum ──────────────────────────────────────────────────────────────

type Step = "search" | "seats" | "passengers" | "payment" | "done";

// ─── Helpers ────────────────────────────────────────────────────────────────

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

export function CounterPosClient() {
  const t = useTranslations();
  const { getValidAccessToken: getToken } = useAuth();
  const qc = useQueryClient();

  // ── Search state ──
  const [step, setStep] = useState<Step>("search");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState(todayDateStr());
  const [page, setPage] = useState(1);
  const [searchParams, setSearchParams] = useState<{
    origin: string;
    destination: string;
    date: string;
  } | null>(null);

  // ── Selected trip ──
  const [selectedTrip, setSelectedTrip] = useState<TripResult | null>(null);
  const [resolvedStops, setResolvedStops] = useState<{ from: string; to: string } | null>(null);

  // ── Seat selection ──
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [activeGender, setActiveGender] = useState<"MALE" | "FEMALE" | "OTHER">("MALE");
  const [seatGenders, setSeatGenders] = useState<Record<string, "MALE" | "FEMALE" | "OTHER">>({});
  const [lock, setLock] = useState<SeatLock | null>(null);

  // ── Passenger forms ──
  const [passengers, setPassengers] = useState<PassengerForm[]>([]);

  // ── Payment ──
  const [paymentMethod, setPaymentMethod] = useState<"CASH_COUNTER" | "CARD_ONLINE">("CASH_COUNTER");

  // ── Results ──
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [tickets, setTickets] = useState<TicketInfo[]>([]);
  const [error, setError] = useState("");

  // ─── Trip search (auto-loads all scheduled trips by default) ───────────────

  const tripsQuery = useQuery({
    queryKey: ["pos-trips", searchParams, page],
    queryFn: async (): Promise<TripSearchApiResponse> => {
      if (searchParams) {
        const params = new URLSearchParams({
          origin_terminal: searchParams.origin,
          destination_terminal: searchParams.destination,
          ...(searchParams.date ? { date: searchParams.date } : {}),
          page: String(page),
          page_size: "8",
        });
        return adminFetch<TripSearchApiResponse>(
          `${API_ENDPOINTS.SEARCH.TRIPS}?${params}`,
          getToken
        );
      }

      const raw = await adminFetch<
        PaginatedData<{
          id: string;
          trip_number: string;
          status: string;
          route: string;
          route_code: string;
          route_name: string;
          origin_city: string;
          destination_city: string;
          bus_registration: string;
          bus_type_display: string;
          total_seats: number;
          available_seats?: number;
          departure_datetime: string;
          arrival_datetime: string;
          base_fare: string;
        }>
      >(`${API_ENDPOINTS.TRIPS.LIST}?status=SCHEDULED&page=${page}&page_size=8`, getToken);
      const paged = normalizePaginated(raw, 8);
      return {
        total_results: paged.count,
        page: paged.current_page,
        page_size: paged.page_size,
        trips: paged.results.map((item) => {
          const avail = item.available_seats ?? item.total_seats;
          return {
            trip_id: item.id,
            trip_number: item.trip_number,
            status: item.status,
            route: { id: item.route, code: item.route_code, name: item.route_name },
            origin: {
              city: item.origin_city,
              terminal_name: item.origin_city,
              departure_time: item.departure_datetime,
            },
            destination: {
              city: item.destination_city,
              terminal_name: item.destination_city,
              arrival_time: item.arrival_datetime,
            },
            bus: {
              registration_number: item.bus_registration,
              bus_type: item.bus_type_display,
              bus_type_display: item.bus_type_display,
              total_seats: item.total_seats,
            },
            fare: { amount: item.base_fare, currency: "PKR" },
            availability: {
              available_seats: avail,
              total_seats: item.total_seats,
              is_sold_out: avail <= 0,
            },
          };
        }),
      };
    },
  });

  const handleSearch = () => {
    if (!origin || !destination) return;
    setSearchParams({ origin, destination, date });
    setPage(1);
  };

  const handleClearSearch = () => {
    setOrigin("");
    setDestination("");
    setSearchParams(null);
    setPage(1);
  };

  // ─── Seat layout ─────────────────────────────────────────────────────────

  const seatsQuery = useQuery({
    queryKey: ["pos-seats", selectedTrip?.trip_id],
    queryFn: async () => {
      const trip = selectedTrip!;
      let fromStop = trip.segment_details?.from_stop_id ?? "";
      let toStop = trip.segment_details?.to_stop_id ?? "";

      if ((!fromStop || !toStop) && trip.route.id) {
        const routeDetail = await adminFetch<{ stops: Array<{ id: string }> }>(
          API_ENDPOINTS.ROUTES.detail(trip.route.id),
          getToken
        );
        const stops = routeDetail.stops ?? [];
        if (stops.length >= 2) {
          fromStop = stops[0]!.id;
          toStop = stops[stops.length - 1]!.id;
        }
      }

      if (fromStop && toStop) {
        setResolvedStops({ from: fromStop, to: toStop });
      }

      const qs = new URLSearchParams();
      if (fromStop) qs.set("from_stop", fromStop);
      if (toStop) qs.set("to_stop", toStop);
      const queryStr = qs.toString() ? `?${qs.toString()}` : "";
      const res = await adminFetch<{ seats: SeatInfo[] } | SeatInfo[]>(
        `${API_ENDPOINTS.SEARCH.seatMap(trip.trip_id)}${queryStr}`,
        getToken
      );
      return Array.isArray(res) ? res : (res.seats ?? []);
    },
    enabled: !!selectedTrip,
  });

  // ─── Lock seats ───────────────────────────────────────────────────────────

  const lockMutation = useMutation({
    mutationFn: async () => {
      const seat_genders = Object.fromEntries(
        selectedSeatIds.map((id) => [id, seatGenders[id] ?? activeGender])
      );
      const fromStop = selectedTrip!.segment_details?.from_stop_id ?? resolvedStops?.from;
      const toStop = selectedTrip!.segment_details?.to_stop_id ?? resolvedStops?.to;
      return adminFetch<SeatLock>(API_ENDPOINTS.BOOKINGS.LOCK_SEATS, getToken, {
        method: "POST",
        body: JSON.stringify({
          trip_id: selectedTrip!.trip_id,
          ...(fromStop ? { from_stop: fromStop } : {}),
          ...(toStop ? { to_stop: toStop } : {}),
          seat_ids: selectedSeatIds,
          seat_genders,
        }),
      });
    },
    onSuccess: (data) => {
      setLock(data);
      // Build passenger forms (one per seat)
      setPassengers(
        selectedSeatIds.map((id) => ({
          full_name: "",
          phone: "",
          cnic_or_id: "",
          is_female: (seatGenders[id] ?? activeGender) === "FEMALE",
        }))
      );
      setStep("passengers");
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  // ─── Create counter booking ───────────────────────────────────────────────

  const bookMutation = useMutation({
    mutationFn: async () => {
      const fromStop = selectedTrip!.segment_details?.from_stop_id ?? resolvedStops?.from;
      const toStop = selectedTrip!.segment_details?.to_stop_id ?? resolvedStops?.to;
      const lead = passengers[0] ?? { full_name: "", phone: "", cnic_or_id: "", is_female: false };
      const payload = {
        trip_id: selectedTrip!.trip_id,
        ...(fromStop ? { from_stop: fromStop } : {}),
        ...(toStop ? { to_stop: toStop } : {}),
        passenger_name: lead.full_name.trim(),
        passenger_phone: lead.phone.trim(),
        payment_method: paymentMethod,
        passengers: selectedSeatIds.map((seatId, i) => {
          const pax = passengers[i] ?? lead;
          return {
            seat_id: seatId,
            passenger_name: pax.full_name.trim(),
            gender: pax.is_female ? "FEMALE" : (seatGenders[seatId] ?? activeGender),
            cnic_or_id: pax.cnic_or_id.trim(),
          };
        }),
      };
      return adminFetch<BookingResult>(API_ENDPOINTS.BOOKINGS.COUNTER, getToken, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async (data) => {
      setBooking(data);
      if (data.status === "PENDING") {
        await adminFetch(API_ENDPOINTS.PAYMENTS.CONFIRM_MOCK, getToken, {
          method: "POST",
          body: JSON.stringify({ pnr: data.pnr, status: "SUCCESS" }),
        });
      }
      // Fetch tickets
      const ticketRes = await adminFetch<TicketInfo[] | { tickets?: TicketInfo[] }>(
        API_ENDPOINTS.TICKETS.byBooking(data.pnr),
        getToken
      );
      const list = Array.isArray(ticketRes) ? ticketRes : (ticketRes.tickets ?? []);
      setTickets(list);
      setStep("done");
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  // ─── Passenger form helpers ───────────────────────────────────────────────

  const updatePassenger = useCallback(
    (index: number, field: keyof PassengerForm, value: string | boolean) => {
      setPassengers((prev) => {
        const next = [...prev];
        const current = next[index] ?? {
          full_name: "",
          phone: "",
          cnic_or_id: "",
          is_female: false,
        };
        next[index] = { ...current, [field]: value };
        return next;
      });
    },
    []
  );

  const passengersValid = passengers.every(
    (p) => p.full_name.trim() && p.phone.trim()
  );

  // ─── Reset ────────────────────────────────────────────────────────────────

  const reset = () => {
    setStep("search");
    setSelectedTrip(null);
    setSelectedSeatIds([]);
    setLock(null);
    setPassengers([]);
    setBooking(null);
    setTickets([]);
    setError("");
    qc.removeQueries({ queryKey: ["pos-seats"] });
  };

  // ─── Seat selection helpers ───────────────────────────────────────────────

  const seatMapData = (seatsQuery.data ?? []).map((s) => ({
    id: s.id,
    seat_number: s.seat_number,
    row: s.row,
    column: s.column ?? s.col ?? 1,
    deck: s.deck,
    seat_type: s.seat_type ?? "STANDARD",
    is_ladies_only: s.is_ladies_only,
    status: s.status as "AVAILABLE" | "LOCKED" | "BOOKED" | "BLOCKED",
    fare: s.fare,
    is_available: s.is_available,
    occupied_gender: s.occupied_gender,
    female_adjacent_restricted: s.female_adjacent_restricted,
    allowed_genders: s.allowed_genders,
  }));

  // ─── Print handler ────────────────────────────────────────────────────────

  const handlePrint = () => window.print();

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("pos.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("pos.subtitle")}</p>
        </div>
        {step !== "search" && (
          <Button variant="outline" size="sm" onClick={reset}>
            <RefreshCcw className="me-2 h-4 w-4" />
            {t("pos.newTransaction")}
          </Button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex gap-1">
        {(["search", "seats", "passengers", "payment", "done"] as Step[]).map(
          (s, i) => (
            <div
              key={s}
              className={`flex h-1.5 flex-1 rounded-full transition-colors ${
                step === s
                  ? "bg-primary"
                  : i <
                    ["search", "seats", "passengers", "payment", "done"].indexOf(step)
                  ? "bg-primary/40"
                  : "bg-muted"
              }`}
            />
          )
        )}
      </div>

      {error && (
        <Alert variant="danger">
          <span>{error}</span>
        </Alert>
      )}

      {/* ── STEP 1: SEARCH ─────────────────────────────────────────────── */}
      {step === "search" && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-4 text-base font-semibold">{t("pos.tripSearch")}</h2>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>{t("pos.origin")}</Label>
                <Input
                  placeholder={t("pos.originPlaceholder")}
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("pos.destination")}</Label>
                <Input
                  placeholder={t("pos.destinationPlaceholder")}
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("pos.date")}</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  className="flex-1"
                  onClick={handleSearch}
                  disabled={!origin || !destination}
                >
                  <Search className="me-2 h-4 w-4" />
                  {t("common.search")}
                </Button>
                {searchParams && (
                  <Button variant="outline" onClick={handleClearSearch}>
                    {t("common.all")}
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Results */}
          {tripsQuery.isLoading && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          )}

          {tripsQuery.data && (tripsQuery.data.trips ?? []).length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              <Bus className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p>{t("pos.noTrips")}</p>
            </Card>
          )}

          {tripsQuery.data && (tripsQuery.data.trips ?? []).length > 0 && (
            <>
              <div className="space-y-3">
                {(tripsQuery.data.trips ?? []).map((trip) => (
                  <Card
                    key={trip.trip_id}
                    className="cursor-pointer p-4 transition-shadow hover:shadow-md"
                    onClick={() => {
                      setSelectedTrip(trip);
                      setStep("seats");
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex flex-1 items-center gap-3">
                        <div className="text-center">
                          <p className="text-lg font-bold">
                            {new Date(trip.origin.departure_time).toLocaleTimeString("en-PK", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {trip.origin.city}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="text-center">
                          <p className="text-lg font-bold">
                            {new Date(trip.destination.arrival_time).toLocaleTimeString("en-PK", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {trip.destination.city}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Bus className="h-4 w-4" />
                        <span>{trip.bus.bus_type_display ?? trip.bus.bus_type}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>
                          {t("common.seatsLeft", { count: trip.availability.available_seats })}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">
                          {formatCurrencyPkr(Number(trip.fare.amount))}
                        </p>
                        <p className="text-xs text-muted-foreground">{t("pos.perSeat")}</p>
                      </div>
                      <StatusBadge status={trip.status} />
                    </div>
                  </Card>
                ))}
              </div>
              <PaginationBar
                currentPage={page}
                totalPages={Math.ceil((tripsQuery.data.total_results ?? 0) / 8)}
                totalCount={tripsQuery.data.total_results ?? 0}
                pageSize={8}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      )}

      {/* ── STEP 2: SEAT SELECTION ─────────────────────────────────────── */}
      {step === "seats" && selectedTrip && (
        <div className="space-y-5">
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {selectedTrip.origin.city} → {selectedTrip.destination.city}
              </span>
              <Clock className="ms-3 h-4 w-4 text-muted-foreground" />
              <span>{formatShortDateTime(selectedTrip.origin.departure_time)}</span>
              <Bus className="ms-3 h-4 w-4 text-muted-foreground" />
              <span>{selectedTrip.bus.registration_number}</span>
            </div>
          </Card>

          {seatsQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Card className="p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{t("pos.selectSeats")}</h2>
                  <Badge variant="info">
                    {selectedSeatIds.length} {t("pos.selected")}
                  </Badge>
                </div>
                <div className="inline-flex rounded-md border bg-muted/40 p-1">
                  {(["MALE", "FEMALE", "OTHER"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setActiveGender(g)}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                        activeGender === g
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {g === "MALE" ? "Male" : g === "FEMALE" ? "Female" : "Other"}
                    </button>
                  ))}
                </div>
              </div>
              <SeatMap
                seats={seatMapData}
                selectedSeatIds={selectedSeatIds}
                activeGender={activeGender}
                onSelectionChange={(nextIds) => {
                  setSelectedSeatIds(nextIds);
                  setSeatGenders((prev) => {
                    const next: Record<string, "MALE" | "FEMALE" | "OTHER"> = {};
                    for (const id of nextIds) {
                      const info = seatsQuery.data?.find((s) => s.id === id);
                      if (info && (info.is_ladies_only || info.female_adjacent_restricted)) {
                        next[id] = "FEMALE";
                      } else {
                        next[id] = prev[id] ?? activeGender;
                      }
                    }
                    return next;
                  });
                }}
              />
              <div className="mt-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("pos.totalFare")}</p>
                  <p className="text-xl font-bold text-primary">
                    {formatCurrencyPkr(
                      selectedSeatIds.length * Number(selectedTrip.fare.amount)
                    )}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("search")}>
                    {t("common.back")}
                  </Button>
                  <Button
                    disabled={selectedSeatIds.length === 0 || lockMutation.isPending}
                    onClick={() => lockMutation.mutate()}
                  >
                    {lockMutation.isPending
                      ? t("pos.locking")
                      : t("pos.holdSeats", { count: selectedSeatIds.length })}
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── STEP 3: PASSENGER DETAILS ──────────────────────────────────── */}
      {step === "passengers" && lock && (
        <div className="space-y-5">
          <Card className="border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-medium">{t("pos.seatHeldUntil")}</p>
              </div>
              <LockCountdown
                lockedUntil={lock.locked_until ?? lock.expires_at ?? ""}
                onExpire={() => {
                  setError(t("pos.lockExpired"));
                  setStep("seats");
                }}
              />
            </div>
          </Card>

          <div className="space-y-4">
            {selectedSeatIds.map((seatId, i) => {
              const seatInfo = seatsQuery.data?.find((s) => s.id === seatId);
              const p = passengers[i];
              if (!p) return null;
              return (
                <Card key={seatId} className="p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {seatInfo?.seat_number ?? i + 1}
                    </div>
                    <h3 className="font-medium">{t("pos.passengerNum", { n: i + 1 })}</h3>
                    {seatInfo?.is_ladies_only && (
                      <Badge variant="ladies" className="text-xs">
                        {t("pos.ladiesOnly")}
                      </Badge>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" /> {t("pos.fullName")} *
                      </Label>
                      <Input
                        value={p.full_name}
                        onChange={(e) => updatePassenger(i, "full_name", e.target.value)}
                        placeholder={t("pos.fullNamePlaceholder")}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" /> {t("pos.phone")} *
                      </Label>
                      <Input
                        value={p.phone}
                        onChange={(e) => updatePassenger(i, "phone", e.target.value)}
                        placeholder="+923001234567"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5">
                        <IdCard className="h-3.5 w-3.5" /> {t("pos.cnicOrId")}
                      </Label>
                      <Input
                        value={p.cnic_or_id}
                        onChange={(e) => updatePassenger(i, "cnic_or_id", e.target.value)}
                        placeholder="4210100000001"
                      />
                    </div>
                    <div className="flex items-end pb-0.5">
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={p.is_female}
                          onChange={(e) => updatePassenger(i, "is_female", e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        {t("pos.femalePassenger")}
                      </label>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setStep("seats");
                setLock(null);
              }}
            >
              {t("common.back")}
            </Button>
            <Button
              disabled={!passengersValid}
              onClick={() => setStep("payment")}
            >
              {t("common.continue")}
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 4: PAYMENT ───────────────────────────────────────────── */}
      {step === "payment" && selectedTrip && lock && (
        <div className="space-y-5">
          <Card className="p-6">
            <h2 className="mb-5 text-base font-semibold">{t("pos.paymentSummary")}</h2>

            {/* Line items */}
            <div className="space-y-2 rounded-lg bg-muted/40 p-4 text-sm">
              {selectedSeatIds.map((seatId, i) => {
                const info = seatsQuery.data?.find((s) => s.id === seatId);
                return (
                  <div key={seatId} className="flex justify-between">
                    <span>
                      {t("pos.seat")} {info?.seat_number} — {passengers[i]?.full_name || `Passenger ${i + 1}`}
                    </span>
                    <span className="font-medium">
                      {formatCurrencyPkr(Number(selectedTrip.fare.amount))}
                    </span>
                  </div>
                );
              })}
              <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold">
                <span>{t("pos.total")}</span>
                <span className="text-primary">
                  {formatCurrencyPkr(
                    selectedSeatIds.length * Number(selectedTrip.fare.amount)
                  )}
                </span>
              </div>
            </div>

            {/* Payment method */}
            <div className="mt-5">
              <Label className="mb-3 block">{t("pos.paymentMethod")}</Label>
              <div className="grid grid-cols-2 gap-3">
                {(["CASH_COUNTER", "CARD_ONLINE"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`flex items-center gap-3 rounded-lg border p-4 text-sm font-medium transition-colors ${
                      paymentMethod === method
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {method === "CASH_COUNTER" ? (
                      <Banknote className="h-5 w-5" />
                    ) : (
                      <CreditCard className="h-5 w-5" />
                    )}
                    {method === "CASH_COUNTER" ? t("pos.cashPayment") : t("pos.cardPayment")}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("passengers")}>
              {t("common.back")}
            </Button>
            <Button
              disabled={bookMutation.isPending}
              onClick={() => bookMutation.mutate()}
              className="min-w-40"
            >
              {bookMutation.isPending ? t("pos.processing") : t("pos.confirmAndIssue")}
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 5: DONE — PRINT TICKETS ──────────────────────────────── */}
      {step === "done" && booking && (
        <div className="space-y-5">
          <Card className="border-green-200 bg-green-50/50 p-6 dark:border-green-800 dark:bg-green-900/20">
            <div className="flex items-start gap-4">
              <CheckCircle className="mt-0.5 h-8 w-8 shrink-0 text-green-600" />
              <div>
                <h2 className="text-lg font-bold text-green-900 dark:text-green-100">
                  {t("pos.bookingConfirmed")}
                </h2>
                <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                  {t("pos.pnr")}: <span className="font-mono font-bold">{booking.pnr}</span>
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {t("pos.amountCollected")}: {formatCurrencyPkr(Number(booking.net_amount ?? booking.total_amount ?? 0))} — {paymentMethod}
                </p>
              </div>
            </div>
          </Card>

          {/* Ticket cards */}
          <div className="grid gap-4 print:gap-2 sm:grid-cols-2">
            {tickets.map((ticket) => (
              <Card key={ticket.ticket_number} className="p-5 print:shadow-none">
                <div className="flex gap-4">
                  {ticket.qr_code_base64 && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:image/png;base64,${ticket.qr_code_base64}`}
                      alt={`QR for ${ticket.ticket_number}`}
                      className="h-24 w-24 shrink-0 rounded-md border"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-bold">{ticket.ticket_number}</p>
                    <p className="text-sm">{ticket.passenger_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("pos.seat")}: {ticket.seat_number}
                    </p>
                    <div className="mt-2">
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000"}/api/tickets/${ticket.ticket_number}/pdf/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline"
                      >
                        {t("payments.downloadPdf")}
                      </a>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex gap-3 print:hidden">
            <Button variant="outline" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              {t("pos.printTickets")}
            </Button>
            <Button onClick={reset}>{t("pos.newTransaction")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
