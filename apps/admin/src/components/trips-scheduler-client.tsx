"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CalendarClock, DollarSign, Plus, Search, Trash2 } from "lucide-react";
import { SeatType, TripStatus } from "@busms/config/constants";
import { ApiException, normalizePaginated, type PaginatedData } from "@busms/api-client";
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
  Input,
  Label,
  PaginationBar,
  SeatMap,
  Skeleton,
  StatusBadge,
  formatCurrencyPkr,
  type SeatMapItem,
} from "@busms/ui";
import { adminFetch, formatShortDateTime, toDateTimeLocalInput } from "@/lib/admin-api";

interface TripListItem {
  id: string;
  trip_number: string;
  status: TripStatus;
  status_display: string;
  route: string;
  route_code: string;
  route_name: string;
  origin_city: string;
  destination_city: string;
  bus: string;
  bus_registration: string;
  bus_type_display: string;
  total_seats: number;
  driver: string | null;
  driver_name: string | null;
  departure_datetime: string;
  arrival_datetime: string;
  base_fare: string;
}

interface TripDetailItem {
  id: string;
  trip_number: string;
  status: TripStatus;
  route: { id: string; code: string; name: string };
  bus: { id: string; registration_number: string };
  seat_blocks: Array<{
    id: string;
    seat: string;
    seat_number: string;
    seat_type: string;
    reason: string;
  }>;
}

interface FareRuleItem {
  id: string;
  route: string;
  route_code: string;
  from_stop: string;
  from_city: string;
  from_stop_order: number;
  to_stop: string;
  to_city: string;
  to_stop_order: number;
  seat_type: SeatType | null;
  fare_amount: string;
}

interface RouteStopOption {
  id: string;
  stop_order: number;
  terminal_name: string;
  terminal_city: string;
}

export function TripsSchedulerClient() {
  const { getValidAccessToken, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"trips" | "fares">("trips");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Create / edit trip state
  const [showTripForm, setShowTripForm] = useState(false);
  const [editingTrip, setEditingTrip] = useState<TripListItem | null>(null);
  const [tripRouteId, setTripRouteId] = useState("");
  const [tripBusId, setTripBusId] = useState("");
  const [tripDriverId, setTripDriverId] = useState("");
  const [tripConductorId, setTripConductorId] = useState("");
  const [tripDep, setTripDep] = useState("");
  const [tripArr, setTripArr] = useState("");
  const [tripBaseFare, setTripBaseFare] = useState("2200");
  const [tripNumber, setTripNumber] = useState("");
  const [tripStatus, setTripStatus] = useState<TripStatus>(TripStatus.SCHEDULED);

  // Seat block panel state
  const [blockTripId, setBlockTripId] = useState<string | null>(null);
  const [selectedBlockSeats, setSelectedBlockSeats] = useState<string[]>([]);
  const [blockReason, setBlockReason] = useState("VIP / Crew Rest");

  // Fare rule form state
  const [fareRouteId, setFareRouteId] = useState("");
  const [fareFromStop, setFareFromStop] = useState("");
  const [fareToStop, setFareToStop] = useState("");
  const [fareSeatType, setFareSeatType] = useState("");
  const [fareAmount, setFareAmount] = useState("2500");

  // Shared lookup lists
  const lookupsQuery = useQuery({
    queryKey: ["trips-lookups"],
    queryFn: async () => {
      const [routesRaw, busesRaw, driversRaw, conductorsRaw] = await Promise.all([
        adminFetch<PaginatedData<{ id: string; code: string; name: string }>>(
          "/api/routes/?page=1&page_size=100",
          getValidAccessToken
        ),
        adminFetch<PaginatedData<{ id: string; registration_number: string; bus_type_display: string }>>(
          "/api/fleet/buses/?page=1&page_size=100",
          getValidAccessToken
        ),
        adminFetch<PaginatedData<{ id: string; full_name: string }>>(
          "/api/fleet/drivers/?page=1&page_size=100",
          getValidAccessToken
        ),
        adminFetch<PaginatedData<{ id: string; full_name: string }>>(
          "/api/fleet/conductors/?page=1&page_size=100",
          getValidAccessToken
        ),
      ]);
      return {
        routes: normalizePaginated(routesRaw, 100).results,
        buses: normalizePaginated(busesRaw, 100).results,
        drivers: normalizePaginated(driversRaw, 100).results,
        conductors: normalizePaginated(conductorsRaw, 100).results,
      };
    },
    enabled: isAuthenticated,
  });

  const tripsQuery = useQuery({
    queryKey: ["admin-trips", page, pageSize, search, statusFilter],
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (search.trim()) qs.set("search", search.trim());
      if (statusFilter) qs.set("status", statusFilter);
      const raw = await adminFetch<PaginatedData<TripListItem> | TripListItem[]>(
        `/api/trips/?${qs.toString()}`,
        getValidAccessToken
      );
      return normalizePaginated(raw, pageSize);
    },
    enabled: isAuthenticated && tab === "trips",
  });

  const tripBlockDetailQuery = useQuery({
    queryKey: ["admin-trip-detail", blockTripId],
    queryFn: async () => {
      const trip = await adminFetch<TripDetailItem>(`/api/trips/${blockTripId}/`, getValidAccessToken);
      const bus = await adminFetch<{
        seats: Array<{
          id: string;
          seat_number: string;
          row: number;
          column: number;
          deck: number;
          seat_type: string;
          is_ladies_only: boolean;
          is_active: boolean;
        }>;
      }>(`/api/fleet/buses/${trip.bus.id}/`, getValidAccessToken);
      return { trip, busSeats: bus.seats };
    },
    enabled: isAuthenticated && Boolean(blockTripId),
  });

  const fareRulesQuery = useQuery({
    queryKey: ["admin-fare-rules", page, pageSize],
    queryFn: async () => {
      const raw = await adminFetch<PaginatedData<FareRuleItem> | FareRuleItem[]>(
        `/api/trips/fare-rules/?page=${page}&page_size=${pageSize}`,
        getValidAccessToken
      );
      return normalizePaginated(raw, pageSize);
    },
    enabled: isAuthenticated && tab === "fares",
  });

  const selectedRouteStopsQuery = useQuery({
    queryKey: ["fare-route-stops", fareRouteId],
    queryFn: async () => {
      const detail = await adminFetch<{ stops: RouteStopOption[] }>(
        `/api/routes/${fareRouteId}/`,
        getValidAccessToken
      );
      return detail.stops ?? [];
    },
    enabled: isAuthenticated && Boolean(fareRouteId),
  });

  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const payload = {
        route: tripRouteId,
        bus: tripBusId,
        driver: tripDriverId || null,
        conductor: tripConductorId || null,
        departure_datetime: new Date(tripDep).toISOString(),
        arrival_datetime: new Date(tripArr).toISOString(),
        base_fare: tripBaseFare,
        ...(tripNumber.trim() ? { trip_number: tripNumber.trim() } : {}),
        ...(editingTrip ? { status: tripStatus } : {}),
      };

      const saved = await adminFetch<TripDetailItem>(
        editingTrip ? `/api/trips/${editingTrip.id}/` : "/api/trips/",
        getValidAccessToken,
        {
          method: editingTrip ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      );

      setShowTripForm(false);
      setEditingTrip(null);
      setSuccessMsg(`Trip ${saved.trip_number} saved cleanly.`);
      await queryClient.invalidateQueries({ queryKey: ["admin-trips"] });
    } catch (err) {
      setErrorMsg(
        err instanceof ApiException ? err.message : "Schedule conflict or invalid trip payload."
      );
    }
  };

  const handleBlockSelectedSeats = async () => {
    if (!blockTripId || selectedBlockSeats.length === 0) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      for (const seatId of selectedBlockSeats) {
        await adminFetch(`/api/trips/${blockTripId}/block-seat/`, getValidAccessToken, {
          method: "POST",
          body: JSON.stringify({ seat_id: seatId, reason: blockReason || "Operational Block" }),
        });
      }
      setSelectedBlockSeats([]);
      setSuccessMsg("Selected seat(s) blocked for this trip.");
      await queryClient.invalidateQueries({ queryKey: ["admin-trip-detail", blockTripId] });
    } catch (err) {
      setErrorMsg(err instanceof ApiException ? err.message : "Failed to block seat.");
    }
  };

  const handleUnblockSeat = async (seatId: string) => {
    if (!blockTripId) return;
    setErrorMsg(null);
    try {
      await adminFetch(
        `/api/trips/${blockTripId}/unblock-seat/${seatId}/`,
        getValidAccessToken,
        { method: "DELETE" }
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-trip-detail", blockTripId] });
    } catch (err) {
      setErrorMsg(err instanceof ApiException ? err.message : "Failed to unblock seat.");
    }
  };

  const handleSaveFareRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await adminFetch("/api/trips/fare-rules/", getValidAccessToken, {
        method: "POST",
        body: JSON.stringify({
          route: fareRouteId,
          from_stop: fareFromStop,
          to_stop: fareToStop,
          seat_type: fareSeatType || null,
          fare_amount: fareAmount,
        }),
      });
      setSuccessMsg("Segment fare rule saved.");
      await queryClient.invalidateQueries({ queryKey: ["admin-fare-rules"] });
    } catch (err) {
      setErrorMsg(err instanceof ApiException ? err.message : "Failed to save fare rule.");
    }
  };

  const handleDeleteFareRule = async (id: string) => {
    await adminFetch(`/api/trips/fare-rules/${id}/`, getValidAccessToken, { method: "DELETE" });
    await queryClient.invalidateQueries({ queryKey: ["admin-fare-rules"] });
  };

  const blockedSet = new Set(
    (tripBlockDetailQuery.data?.trip.seat_blocks ?? []).map((b) => b.seat)
  );
  const blockMapSeats: SeatMapItem[] = (tripBlockDetailQuery.data?.busSeats ?? []).map((s) => ({
    id: s.id,
    seat_number: s.seat_number,
    row: s.row,
    column: s.column,
    deck: s.deck,
    seat_type: s.seat_type,
    is_ladies_only: s.is_ladies_only,
    status: !s.is_active || blockedSet.has(s.id) ? "BLOCKED" : "AVAILABLE",
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trip Scheduler & Fare Matrix</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Schedule trips with automated bus/driver/conductor overlap checks, block VIP seats, and configure segment fare rules.
          </p>
        </div>

        <div className="flex gap-1 rounded-lg border bg-card p-1">
          {[
            { key: "trips", label: "Scheduled Trips", icon: CalendarClock },
            { key: "fares", label: "Segment Fare Matrix", icon: DollarSign },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setTab(item.key as typeof tab);
                  setPage(1);
                }}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === item.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {errorMsg && <Alert variant="danger">{errorMsg}</Alert>}
      {successMsg && <Alert variant="success">{successMsg}</Alert>}

      {/* TAB: SCHEDULED TRIPS */}
      {tab === "trips" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search trip # or bus..."
                  className="ps-9"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by trip status"
                className="h-10 rounded-md border border-input bg-card px-3 text-sm"
              >
                <option value="">All Statuses</option>
                <option value={TripStatus.SCHEDULED}>Scheduled</option>
                <option value={TripStatus.BOARDING}>Boarding</option>
                <option value={TripStatus.DEPARTED}>Departed</option>
                <option value={TripStatus.COMPLETED}>Completed</option>
                <option value={TripStatus.CANCELLED}>Cancelled</option>
              </select>
            </div>

            <Button
              onClick={() => {
                setEditingTrip(null);
                setTripNumber("");
                setShowTripForm((prev) => !prev);
              }}
            >
              <Plus className="h-4 w-4" />
              <span>Schedule Trip</span>
            </Button>
          </div>

          {showTripForm && lookupsQuery.data && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {editingTrip ? `Edit ${editingTrip.trip_number}` : "Schedule New Trip"}
                </CardTitle>
                <CardDescription>
                  Overlap validation protects against double-booking buses, drivers, or conductors.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveTrip} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <Label>Route Corridor</Label>
                    <select
                      required
                      value={tripRouteId}
                      onChange={(e) => setTripRouteId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
                    >
                      <option value="">Select route...</option>
                      {lookupsQuery.data.routes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.code} — {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label>Coach Bus</Label>
                    <select
                      required
                      value={tripBusId}
                      onChange={(e) => setTripBusId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
                    >
                      <option value="">Select bus...</option>
                      {lookupsQuery.data.buses.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.registration_number} ({b.bus_type_display})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label>Driver (optional)</Label>
                    <select
                      value={tripDriverId}
                      onChange={(e) => setTripDriverId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
                    >
                      <option value="">Unassigned</option>
                      {lookupsQuery.data.drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label>Conductor (optional)</Label>
                    <select
                      value={tripConductorId}
                      onChange={(e) => setTripConductorId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
                    >
                      <option value="">Unassigned</option>
                      {lookupsQuery.data.conductors.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label>Departure</Label>
                    <Input
                      type="datetime-local"
                      required
                      value={tripDep}
                      onChange={(e) => setTripDep(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Arrival</Label>
                    <Input
                      type="datetime-local"
                      required
                      value={tripArr}
                      onChange={(e) => setTripArr(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Base Fare (PKR)</Label>
                    <Input
                      type="number"
                      required
                      min={0}
                      value={tripBaseFare}
                      onChange={(e) => setTripBaseFare(e.target.value)}
                    />
                  </div>

                  {editingTrip ? (
                    <div className="space-y-1">
                      <Label>Trip Status</Label>
                      <select
                        value={tripStatus}
                        onChange={(e) => setTripStatus(e.target.value as TripStatus)}
                        className="flex h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
                      >
                        <option value={TripStatus.SCHEDULED}>Scheduled</option>
                        <option value={TripStatus.BOARDING}>Boarding</option>
                        <option value={TripStatus.DEPARTED}>Departed</option>
                        <option value={TripStatus.COMPLETED}>Completed</option>
                        <option value={TripStatus.CANCELLED}>Cancelled</option>
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label>Trip # (optional auto)</Label>
                      <Input
                        placeholder="TRIP-LHR-01"
                        value={tripNumber}
                        onChange={(e) => setTripNumber(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
                    <Button type="submit">Save Schedule</Button>
                    <Button type="button" variant="outline" onClick={() => setShowTripForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Scheduled Departures</CardTitle>
              </CardHeader>
              <CardContent>
                {tripsQuery.isLoading ? (
                  <Skeleton className="h-56" />
                ) : (
                  <>
                    <div className="divide-y text-sm">
                      {(tripsQuery.data?.results ?? []).map((trip) => (
                        <div
                          key={trip.id}
                          className={`flex flex-wrap items-center justify-between gap-3 py-3 ${
                            blockTripId === trip.id ? "bg-primary/5 px-2 rounded" : ""
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-semibold">{trip.trip_number}</span>
                              <StatusBadge status={trip.status} />
                              <Badge variant="neutral" className="font-mono text-[11px]">
                                {trip.route_code}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {trip.origin_city} → {trip.destination_city} · Bus{" "}
                              <strong className="font-mono text-foreground">
                                {trip.bus_registration}
                              </strong>
                            </p>
                            <p className="font-mono text-xs text-muted-foreground tabular-nums">
                              {formatShortDateTime(trip.departure_datetime)} →{" "}
                              {formatShortDateTime(trip.arrival_datetime)} · Base{" "}
                              {formatCurrencyPkr(trip.base_fare)}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant={blockTripId === trip.id ? "default" : "outline"}
                              onClick={() => {
                                setBlockTripId(trip.id);
                                setSelectedBlockSeats([]);
                              }}
                            >
                              <Ban className="h-3.5 w-3.5" />
                              <span>Seat Blocks</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingTrip(trip);
                                setTripRouteId(trip.route);
                                setTripBusId(trip.bus);
                                setTripDriverId(trip.driver || "");
                                setTripDep(toDateTimeLocalInput(trip.departure_datetime));
                                setTripArr(toDateTimeLocalInput(trip.arrival_datetime));
                                setTripBaseFare(trip.base_fare);
                                setTripStatus(trip.status);
                                setShowTripForm(true);
                              }}
                            >
                              Edit
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {tripsQuery.data && (
                      <PaginationBar
                        currentPage={tripsQuery.data.current_page}
                        totalPages={tripsQuery.data.total_pages}
                        totalCount={tripsQuery.data.count}
                        pageSize={tripsQuery.data.page_size}
                        onPageChange={setPage}
                        onPageSizeChange={(next) => {
                          setPageSize(next);
                          setPage(1);
                        }}
                      />
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Per-Trip Seat Block Panel */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-base">Trip Seat Blocks</CardTitle>
                <CardDescription>
                  {tripBlockDetailQuery.data
                    ? `${tripBlockDetailQuery.data.trip.trip_number} · Select seats to block for VIP/crew`
                    : "Choose a trip to manage operational seat blocks."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {blockTripId && tripBlockDetailQuery.data && (
                  <>
                    <div className="flex gap-2">
                      <Input
                        value={blockReason}
                        onChange={(e) => setBlockReason(e.target.value)}
                        placeholder="Block reason..."
                      />
                      <Button
                        size="sm"
                        disabled={selectedBlockSeats.length === 0}
                        onClick={handleBlockSelectedSeats}
                      >
                        Block ({selectedBlockSeats.length})
                      </Button>
                    </div>

                    <SeatMap
                      seats={blockMapSeats}
                      selectedSeatIds={selectedBlockSeats}
                      onSelectionChange={setSelectedBlockSeats}
                    />

                    {tripBlockDetailQuery.data.trip.seat_blocks.length > 0 && (
                      <div className="space-y-1.5 border-t pt-3">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Blocked Seats ({tripBlockDetailQuery.data.trip.seat_blocks.length})
                        </p>
                        {tripBlockDetailQuery.data.trip.seat_blocks.map((b) => (
                          <div
                            key={b.id}
                            className="flex items-center justify-between rounded border px-2.5 py-1.5 text-xs"
                          >
                            <span>
                              <strong className="font-mono">{b.seat_number}</strong> · {b.reason}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUnblockSeat(b.seat)}
                            >
                              Unblock
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB: FARE MATRIX */}
      {tab === "fares" && (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Add Segment Fare Override</CardTitle>
              <CardDescription>
                Override stop-to-stop pricing per corridor and seat type.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveFareRule} className="space-y-3">
                <div className="space-y-1">
                  <Label>Route Corridor</Label>
                  <select
                    required
                    value={fareRouteId}
                    onChange={(e) => {
                      setFareRouteId(e.target.value);
                      setFareFromStop("");
                      setFareToStop("");
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
                  >
                    <option value="">Select route...</option>
                    {(lookupsQuery.data?.routes ?? []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code} — {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label>From Stop</Label>
                  <select
                    required
                    value={fareFromStop}
                    onChange={(e) => setFareFromStop(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
                  >
                    <option value="">Select boarding stop...</option>
                    {(selectedRouteStopsQuery.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        #{s.stop_order} {s.terminal_city} ({s.terminal_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label>To Stop</Label>
                  <select
                    required
                    value={fareToStop}
                    onChange={(e) => setFareToStop(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
                  >
                    <option value="">Select alighting stop...</option>
                    {(selectedRouteStopsQuery.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        #{s.stop_order} {s.terminal_city} ({s.terminal_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Seat Type</Label>
                    <select
                      value={fareSeatType}
                      onChange={(e) => setFareSeatType(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
                    >
                      <option value="">All Seat Types</option>
                      <option value={SeatType.WINDOW}>Window</option>
                      <option value={SeatType.AISLE}>Aisle</option>
                      <option value={SeatType.SLEEPER_LOWER}>Sleeper Lower</option>
                      <option value={SeatType.SLEEPER_UPPER}>Sleeper Upper</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Fare (PKR)</Label>
                    <Input
                      type="number"
                      required
                      min={1}
                      value={fareAmount}
                      onChange={(e) => setFareAmount(e.target.value)}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  Save Fare Rule
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configured Segment Fare Rules</CardTitle>
            </CardHeader>
            <CardContent>
              {fareRulesQuery.isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <>
                  <div className="divide-y text-sm">
                    {(fareRulesQuery.data?.results ?? []).map((rule) => (
                      <div key={rule.id} className="flex items-center justify-between gap-3 py-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="neutral" className="font-mono text-[11px]">
                              {rule.route_code}
                            </Badge>
                            <span className="font-semibold">
                              {rule.from_city} → {rule.to_city}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Stop #{rule.from_stop_order} → #{rule.to_stop_order} ·{" "}
                            {rule.seat_type ? rule.seat_type : "All seat types"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-semibold tabular-nums">
                            {formatCurrencyPkr(rule.fare_amount)}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Delete fare rule"
                            onClick={() => handleDeleteFareRule(rule.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {fareRulesQuery.data && (
                    <PaginationBar
                      currentPage={fareRulesQuery.data.current_page}
                      totalPages={fareRulesQuery.data.total_pages}
                      totalCount={fareRulesQuery.data.count}
                      pageSize={fareRulesQuery.data.page_size}
                      onPageChange={setPage}
                      onPageSizeChange={(next) => {
                        setPageSize(next);
                        setPage(1);
                      }}
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
