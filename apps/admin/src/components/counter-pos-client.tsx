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
import { API_ENDPOINTS } from "@busms/config/endpoints";
import { adminFetch, formatShortDateTime } from "@/lib/admin-api";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Terminal {
  id: string;
  name: string;
  city: string;
  code: string;
}

interface TripResult {
  id: string;
  route: { origin_terminal: Terminal; destination_terminal: Terminal; code: string };
  bus: { registration_number: string; bus_type_display: string };
  departure_datetime: string;
  arrival_datetime: string;
  available_seats: number;
  base_fare: string;
  status: string;
}

interface SeatInfo {
  id: string;
  seat_number: string;
  row: number;
  col: number;
  deck: number;
  is_ladies_only: boolean;
  is_active: boolean;
  status: string;
  status_display: string;
  is_available?: boolean;
  occupied_gender?: string | null;
  female_adjacent_restricted?: boolean;
  allowed_genders?: string[];
}

interface SeatLock {
  lock_token: string;
  locked_seats: string[];
  expires_at: string;
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
  total_amount: string;
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

  // ── Seat selection ──
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [activeGender, setActiveGender] = useState<"MALE" | "FEMALE" | "OTHER">("MALE");
  const [seatGenders, setSeatGenders] = useState<Record<string, "MALE" | "FEMALE" | "OTHER">>({});
  const [lock, setLock] = useState<SeatLock | null>(null);

  // ── Passenger forms ──
  const [passengers, setPassengers] = useState<PassengerForm[]>([]);

  // ── Payment ──
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD">("CASH");

  // ── Results ──
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [tickets, setTickets] = useState<TicketInfo[]>([]);
  const [error, setError] = useState("");

  // ─── Trip search ─────────────────────────────────────────────────────────

  const tripsQuery = useQuery({
    queryKey: ["pos-trips", searchParams, page],
    queryFn: async () => {
      if (!searchParams) return { results: [], count: 0, next: null };
      const params = new URLSearchParams({
        origin_terminal: searchParams.origin,
        destination_terminal: searchParams.destination,
        date: searchParams.date,
        page: String(page),
        page_size: "8",
      });
      return adminFetch<{ results: TripResult[]; count: number; next: string | null }>(
        `${API_ENDPOINTS.SEARCH.TRIPS}?${params}`,
        getToken
      );
    },
    enabled: !!searchParams,
  });

  const handleSearch = () => {
    if (!origin || !destination) return;
    setSearchParams({ origin, destination, date });
    setPage(1);
  };

  // ─── Seat layout ─────────────────────────────────────────────────────────

  const seatsQuery = useQuery({
    queryKey: ["pos-seats", selectedTrip?.id],
    queryFn: () =>
      adminFetch<SeatInfo[]>(API_ENDPOINTS.TRIPS.seats(selectedTrip!.id), getToken),
    enabled: !!selectedTrip,
  });

  // ─── Lock seats ───────────────────────────────────────────────────────────

  const lockMutation = useMutation({
    mutationFn: async () => {
      const seat_genders = Object.fromEntries(
        selectedSeatIds.map((id) => [id, seatGenders[id] ?? activeGender])
      );
      return adminFetch<SeatLock>(API_ENDPOINTS.BOOKINGS.LOCK_SEATS, getToken, {
        method: "POST",
        body: JSON.stringify({
          trip_id: selectedTrip!.id,
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
      const payload = {
        trip_id: selectedTrip!.id,
        lock_token: lock!.lock_token,
        payment_method: paymentMethod,
        passengers: selectedSeatIds.map((seatId, i) => {
          const pax = passengers[i] ?? {
            full_name: "",
            phone: "",
            cnic_or_id: "",
            is_female: false,
          };
          return {
            seat_id: seatId,
            full_name: pax.full_name,
            phone: pax.phone,
            cnic_or_id: pax.cnic_or_id,
            is_female: pax.is_female,
            gender: pax.is_female ? "FEMALE" : (seatGenders[seatId] ?? activeGender),
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
      // Confirm mock payment
      await adminFetch(API_ENDPOINTS.PAYMENTS.CONFIRM_MOCK, getToken, {
        method: "POST",
        body: JSON.stringify({ pnr: data.pnr, status: "SUCCESS" }),
      });
      // Fetch tickets
      const ticketList = await adminFetch<TicketInfo[]>(
        API_ENDPOINTS.TICKETS.byBooking(data.pnr),
        getToken
      );
      setTickets(Array.isArray(ticketList) ? ticketList : []);
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
    column: s.col,
    deck: s.deck,
    seat_type: "STANDARD",
    is_ladies_only: s.is_ladies_only,
    status: s.status as "AVAILABLE" | "LOCKED" | "BOOKED" | "BLOCKED",
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
              <div className="flex items-end">
                <Button
                  className="w-full"
                  onClick={handleSearch}
                  disabled={!origin || !destination}
                >
                  <Search className="me-2 h-4 w-4" />
                  {t("common.search")}
                </Button>
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

          {tripsQuery.data && tripsQuery.data.results.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              <Bus className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p>{t("pos.noTrips")}</p>
            </Card>
          )}

          {tripsQuery.data && tripsQuery.data.results.length > 0 && (
            <>
              <div className="space-y-3">
                {tripsQuery.data.results.map((trip) => (
                  <Card
                    key={trip.id}
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
                            {new Date(trip.departure_datetime).toLocaleTimeString("en-PK", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {trip.route.origin_terminal.city}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="text-center">
                          <p className="text-lg font-bold">
                            {new Date(trip.arrival_datetime).toLocaleTimeString("en-PK", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {trip.route.destination_terminal.city}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Bus className="h-4 w-4" />
                        <span>{trip.bus.bus_type_display}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{trip.available_seats} {t("common.seatsLeft", { count: trip.available_seats })}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">
                          {formatCurrencyPkr(Number(trip.base_fare))}
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
                totalPages={Math.ceil((tripsQuery.data.count ?? 0) / 8)}
                totalCount={tripsQuery.data.count ?? 0}
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
                {selectedTrip.route.origin_terminal.city} →{" "}
                {selectedTrip.route.destination_terminal.city}
              </span>
              <Clock className="ms-3 h-4 w-4 text-muted-foreground" />
              <span>{formatShortDateTime(selectedTrip.departure_datetime)}</span>
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
                      selectedSeatIds.length * Number(selectedTrip.base_fare)
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
                lockedUntil={lock.expires_at}
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
                      {formatCurrencyPkr(Number(selectedTrip.base_fare))}
                    </span>
                  </div>
                );
              })}
              <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold">
                <span>{t("pos.total")}</span>
                <span className="text-primary">
                  {formatCurrencyPkr(
                    selectedSeatIds.length * Number(selectedTrip.base_fare)
                  )}
                </span>
              </div>
            </div>

            {/* Payment method */}
            <div className="mt-5">
              <Label className="mb-3 block">{t("pos.paymentMethod")}</Label>
              <div className="grid grid-cols-2 gap-3">
                {(["CASH", "CARD"] as const).map((method) => (
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
                    {method === "CASH" ? (
                      <Banknote className="h-5 w-5" />
                    ) : (
                      <CreditCard className="h-5 w-5" />
                    )}
                    {method === "CASH" ? t("pos.cashPayment") : t("pos.cardPayment")}
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
                  {t("pos.amountCollected")}: {formatCurrencyPkr(Number(booking.total_amount))} — {paymentMethod}
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
