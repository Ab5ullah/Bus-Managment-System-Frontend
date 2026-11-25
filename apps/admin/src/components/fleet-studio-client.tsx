"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bus, Grid3X3, Pencil, Plus, Search, Trash2, UserCheck, Users } from "lucide-react";
import { BusStatus, BusType, SeatType } from "@busms/config/constants";
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
  type SeatMapItem,
} from "@busms/ui";
import { adminFetch } from "@/lib/admin-api";

interface BusSummary {
  id: string;
  registration_number: string;
  name: string;
  bus_type: BusType;
  bus_type_display: string;
  total_seats: number;
  amenities: string[];
  status: BusStatus;
  status_display: string;
  is_active: boolean;
}

interface BusSeatDetail {
  id: string;
  seat_number: string;
  row: number;
  column: number;
  deck: number;
  seat_type: SeatType;
  is_ladies_only: boolean;
  is_active: boolean;
}

interface BusDetail extends BusSummary {
  seats: BusSeatDetail[];
}

interface DriverRecord {
  id: string;
  full_name: string;
  license_number: string;
  phone: string;
  experience_years: number;
  status: string;
  status_display: string;
  is_active: boolean;
}

interface ConductorRecord {
  id: string;
  full_name: string;
  employee_id: string;
  phone: string;
  status: string;
  status_display: string;
  is_active: boolean;
}

export function FleetStudioClient() {
  const { getValidAccessToken, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"buses" | "drivers" | "conductors">("buses");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Bus creation / edit state
  const [showBusForm, setShowBusForm] = useState(false);
  const [editingBus, setEditingBus] = useState<BusSummary | null>(null);
  const [busReg, setBusReg] = useState("");
  const [busName, setBusName] = useState("");
  const [busType, setBusType] = useState<BusType>(BusType.EXECUTIVE);
  const [busStatus, setBusStatus] = useState<BusStatus>(BusStatus.ACTIVE);
  const [busAmenities, setBusAmenities] = useState("WiFi, USB, AC");

  // Selected Bus for Seat Layout Studio
  const [studioBusId, setStudioBusId] = useState<string | null>(null);
  const [layoutType, setLayoutType] = useState<"2x2" | "2x1" | "1x1" | "sleeper_2x1">("2x2");
  const [layoutRows, setLayoutRows] = useState(10);
  const [layoutDecks, setLayoutDecks] = useState(1);
  const [layoutLadiesRows, setLayoutLadiesRows] = useState(2);

  // Driver form state
  const [editingDriver, setEditingDriver] = useState<DriverRecord | null>(null);
  const [drvName, setDrvName] = useState("");
  const [drvLicense, setDrvLicense] = useState("");
  const [drvPhone, setDrvPhone] = useState("");
  const [drvExp, setDrvExp] = useState(3);
  const [drvStatus, setDrvStatus] = useState("AVAILABLE");

  // Conductor form state
  const [editingConductor, setEditingConductor] = useState<ConductorRecord | null>(null);
  const [conName, setConName] = useState("");
  const [conEmpId, setConEmpId] = useState("");
  const [conPhone, setConPhone] = useState("");
  const [conStatus, setConStatus] = useState("AVAILABLE");

  const qs = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (search.trim()) qs.set("search", search.trim());

  const busesQuery = useQuery({
    queryKey: ["admin-buses", page, pageSize, search],
    queryFn: async () => {
      const raw = await adminFetch<PaginatedData<BusSummary> | BusSummary[]>(
        `/api/fleet/buses/?${qs.toString()}`,
        getValidAccessToken
      );
      return normalizePaginated(raw, pageSize);
    },
    enabled: isAuthenticated && tab === "buses",
  });

  const busDetailQuery = useQuery({
    queryKey: ["admin-bus-detail", studioBusId],
    queryFn: () => adminFetch<BusDetail>(`/api/fleet/buses/${studioBusId}/`, getValidAccessToken),
    enabled: isAuthenticated && Boolean(studioBusId),
  });

  const driversQuery = useQuery({
    queryKey: ["admin-drivers", page, pageSize, search],
    queryFn: async () => {
      const raw = await adminFetch<PaginatedData<DriverRecord> | DriverRecord[]>(
        `/api/fleet/drivers/?${qs.toString()}`,
        getValidAccessToken
      );
      return normalizePaginated(raw, pageSize);
    },
    enabled: isAuthenticated && tab === "drivers",
  });

  const conductorsQuery = useQuery({
    queryKey: ["admin-conductors", page, pageSize, search],
    queryFn: async () => {
      const raw = await adminFetch<PaginatedData<ConductorRecord> | ConductorRecord[]>(
        `/api/fleet/conductors/?${qs.toString()}`,
        getValidAccessToken
      );
      return normalizePaginated(raw, pageSize);
    },
    enabled: isAuthenticated && tab === "conductors",
  });

  const handleSaveBus = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const amenitiesList = busAmenities
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        registration_number: busReg.trim().toUpperCase(),
        name: busName.trim(),
        bus_type: busType,
        status: busStatus,
        amenities: amenitiesList,
        ...(editingBus
          ? {}
          : {
              layout: {
                layout_type: layoutType,
                rows: layoutRows,
                deck_count: layoutDecks,
                ladies_rows: layoutLadiesRows,
              },
            }),
      };

      const saved = await adminFetch<BusDetail>(
        editingBus ? `/api/fleet/buses/${editingBus.id}/` : "/api/fleet/buses/",
        getValidAccessToken,
        {
          method: editingBus ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      );

      setShowBusForm(false);
      setEditingBus(null);
      setStudioBusId(saved.id);
      setSuccessMsg(`Bus ${saved.registration_number} saved.`);
      await queryClient.invalidateQueries({ queryKey: ["admin-buses"] });
    } catch (err) {
      setErrorMsg(err instanceof ApiException ? err.message : "Failed to save bus.");
    }
  };

  const handleGenerateMatrix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studioBusId) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await adminFetch<BusDetail>(
        `/api/fleet/buses/${studioBusId}/generate-seats/`,
        getValidAccessToken,
        {
          method: "POST",
          body: JSON.stringify({
            layout_type: layoutType,
            rows: layoutRows,
            deck_count: layoutDecks,
            ladies_rows: layoutLadiesRows,
          }),
        }
      );
      setSuccessMsg("Seat layout matrix regenerated.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-bus-detail", studioBusId] }),
        queryClient.invalidateQueries({ queryKey: ["admin-buses"] }),
      ]);
    } catch (err) {
      setErrorMsg(err instanceof ApiException ? err.message : "Failed to generate seats.");
    }
  };

  const handleToggleSeatAttribute = async (seat: BusSeatDetail, patch: Partial<BusSeatDetail>) => {
    if (!studioBusId) return;
    setErrorMsg(null);
    try {
      await adminFetch(
        `/api/fleet/buses/${studioBusId}/seats/${seat.id}/`,
        getValidAccessToken,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        }
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-bus-detail", studioBusId] });
    } catch (err) {
      setErrorMsg(err instanceof ApiException ? err.message : "Failed to update seat.");
    }
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const payload = {
        full_name: drvName,
        license_number: drvLicense,
        phone: drvPhone,
        experience_years: Number(drvExp),
        status: drvStatus,
      };
      await adminFetch(
        editingDriver ? `/api/fleet/drivers/${editingDriver.id}/` : "/api/fleet/drivers/",
        getValidAccessToken,
        { method: editingDriver ? "PATCH" : "POST", body: JSON.stringify(payload) }
      );
      setEditingDriver(null);
      setDrvName("");
      setDrvLicense("");
      setDrvPhone("");
      setSuccessMsg("Driver record saved.");
      await queryClient.invalidateQueries({ queryKey: ["admin-drivers"] });
    } catch (err) {
      setErrorMsg(err instanceof ApiException ? err.message : "Failed to save driver.");
    }
  };

  const handleDeleteDriver = async (id: string) => {
    await adminFetch(`/api/fleet/drivers/${id}/`, getValidAccessToken, { method: "DELETE" });
    await queryClient.invalidateQueries({ queryKey: ["admin-drivers"] });
  };

  const handleSaveConductor = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const payload = {
        full_name: conName,
        employee_id: conEmpId,
        phone: conPhone,
        status: conStatus,
      };
      await adminFetch(
        editingConductor
          ? `/api/fleet/conductors/${editingConductor.id}/`
          : "/api/fleet/conductors/",
        getValidAccessToken,
        { method: editingConductor ? "PATCH" : "POST", body: JSON.stringify(payload) }
      );
      setEditingConductor(null);
      setConName("");
      setConEmpId("");
      setConPhone("");
      setSuccessMsg("Conductor record saved.");
      await queryClient.invalidateQueries({ queryKey: ["admin-conductors"] });
    } catch (err) {
      setErrorMsg(err instanceof ApiException ? err.message : "Failed to save conductor.");
    }
  };

  const handleDeleteConductor = async (id: string) => {
    await adminFetch(`/api/fleet/conductors/${id}/`, getValidAccessToken, { method: "DELETE" });
    await queryClient.invalidateQueries({ queryKey: ["admin-conductors"] });
  };

  const studioSeatsForMap: SeatMapItem[] = (busDetailQuery.data?.seats ?? []).map((s) => ({
    id: s.id,
    seat_number: s.seat_number,
    row: s.row,
    column: s.column,
    deck: s.deck,
    seat_type: s.seat_type,
    is_ladies_only: s.is_ladies_only,
    status: s.is_active ? "AVAILABLE" : "BLOCKED",
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fleet & Seat Layout Studio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage physical coaches, configure 2×2 / 2×1 / Sleeper seat matrices, ladies-only rows, drivers, and conductors.
          </p>
        </div>

        <div className="flex gap-1 rounded-lg border bg-card p-1">
          {[
            { key: "buses", label: "Buses & Layouts", icon: Bus },
            { key: "drivers", label: "Drivers", icon: Users },
            { key: "conductors", label: "Conductors", icon: UserCheck },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setTab(item.key as typeof tab);
                  setPage(1);
                  setSearch("");
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

      {/* Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={`Search ${tab}...`}
            className="ps-9"
          />
        </div>

        {tab === "buses" && (
          <Button
            onClick={() => {
              setEditingBus(null);
              setBusReg("");
              setBusName("");
              setBusType(BusType.EXECUTIVE);
              setBusStatus(BusStatus.ACTIVE);
              setShowBusForm((prev) => !prev);
            }}
          >
            <Plus className="h-4 w-4" />
            <span>Add Bus</span>
          </Button>
        )}
      </div>

      {/* TAB: BUSES & SEAT STUDIO */}
      {tab === "buses" && (
        <div className="space-y-6">
          {showBusForm && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {editingBus ? `Edit Bus ${editingBus.registration_number}` : "Register New Bus"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveBus} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label>Registration Plate</Label>
                    <Input
                      required
                      placeholder="LEA-2026"
                      value={busReg}
                      onChange={(e) => setBusReg(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Coach Name</Label>
                    <Input
                      placeholder="SafarLine Gold 01"
                      value={busName}
                      onChange={(e) => setBusName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Coach Class</Label>
                    <select
                      value={busType}
                      onChange={(e) => setBusType(e.target.value as BusType)}
                      className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                    >
                      <option value={BusType.STANDARD_AC}>Standard AC</option>
                      <option value={BusType.EXECUTIVE}>Executive</option>
                      <option value={BusType.SLEEPER}>Sleeper</option>
                      <option value={BusType.LUXURY}>Luxury</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <select
                      value={busStatus}
                      onChange={(e) => setBusStatus(e.target.value as BusStatus)}
                      className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                    >
                      <option value={BusStatus.ACTIVE}>Active</option>
                      <option value={BusStatus.MAINTENANCE}>Maintenance</option>
                      <option value={BusStatus.RETIRED}>Retired</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Amenities (comma-separated)</Label>
                    <Input value={busAmenities} onChange={(e) => setBusAmenities(e.target.value)} />
                  </div>

                  {!editingBus && (
                    <>
                      <div className="space-y-1.5">
                        <Label>Initial Seat Layout</Label>
                        <select
                          value={layoutType}
                          onChange={(e) => setLayoutType(e.target.value as typeof layoutType)}
                          className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                        >
                          <option value="2x2">2 × 2 Standard</option>
                          <option value="2x1">2 × 1 Executive / Luxury</option>
                          <option value="sleeper_2x1">Sleeper 2 × 1</option>
                          <option value="1x1">1 × 1 VIP</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1.5">
                          <Label>Rows</Label>
                          <Input
                            type="number"
                            min={1}
                            max={30}
                            value={layoutRows}
                            onChange={(e) => setLayoutRows(Number(e.target.value))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Decks</Label>
                          <Input
                            type="number"
                            min={1}
                            max={2}
                            value={layoutDecks}
                            onChange={(e) => setLayoutDecks(Number(e.target.value))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Ladies</Label>
                          <Input
                            type="number"
                            min={0}
                            max={10}
                            value={layoutLadiesRows}
                            onChange={(e) => setLayoutLadiesRows(Number(e.target.value))}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
                    <Button type="submit">Save Bus</Button>
                    <Button type="button" variant="outline" onClick={() => setShowBusForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
            {/* Bus Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Registered Fleet</CardTitle>
              </CardHeader>
              <CardContent>
                {busesQuery.isLoading ? (
                  <Skeleton className="h-56" />
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-start text-xs text-muted-foreground">
                            <th className="pb-2.5 text-start font-medium">Registration</th>
                            <th className="pb-2.5 text-start font-medium">Class</th>
                            <th className="pb-2.5 text-start font-medium">Seats</th>
                            <th className="pb-2.5 text-start font-medium">Status</th>
                            <th className="pb-2.5 text-end font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(busesQuery.data?.results ?? []).map((bus) => (
                            <tr
                              key={bus.id}
                              className={studioBusId === bus.id ? "bg-primary/5" : undefined}
                            >
                              <td className="py-3">
                                <p className="font-mono font-semibold">{bus.registration_number}</p>
                                <p className="text-xs text-muted-foreground">{bus.name || "—"}</p>
                              </td>
                              <td className="py-3 text-xs">{bus.bus_type_display}</td>
                              <td className="py-3 font-mono tabular-nums">{bus.total_seats}</td>
                              <td className="py-3">
                                <StatusBadge status={bus.status} />
                              </td>
                              <td className="py-3 text-end">
                                <div className="inline-flex gap-1.5">
                                  <Button
                                    size="sm"
                                    variant={studioBusId === bus.id ? "default" : "outline"}
                                    onClick={() => setStudioBusId(bus.id)}
                                  >
                                    <Grid3X3 className="h-3.5 w-3.5" />
                                    <span>Seats</span>
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label="Edit bus"
                                    onClick={() => {
                                      setEditingBus(bus);
                                      setBusReg(bus.registration_number);
                                      setBusName(bus.name || "");
                                      setBusType(bus.bus_type);
                                      setBusStatus(bus.status);
                                      setBusAmenities((bus.amenities || []).join(", "));
                                      setShowBusForm(true);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {busesQuery.data && (
                      <PaginationBar
                        currentPage={busesQuery.data.current_page}
                        totalPages={busesQuery.data.total_pages}
                        totalCount={busesQuery.data.count}
                        pageSize={busesQuery.data.page_size}
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

            {/* Visual Seat Layout Studio */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-base">Seat Layout Studio</CardTitle>
                <CardDescription>
                  {busDetailQuery.data
                    ? `${busDetailQuery.data.registration_number} · ${busDetailQuery.data.total_seats} physical seats`
                    : "Select a bus from the table to preview and configure seats."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {studioBusId && busDetailQuery.data && (
                  <>
                    <form
                      onSubmit={handleGenerateMatrix}
                      className="space-y-3 rounded-lg border bg-muted/40 p-3 text-xs"
                    >
                      <p className="font-semibold">Regenerate Seat Matrix</p>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={layoutType}
                          onChange={(e) => setLayoutType(e.target.value as typeof layoutType)}
                          className="h-8 rounded border border-input bg-card px-2"
                        >
                          <option value="2x2">2 × 2</option>
                          <option value="2x1">2 × 1</option>
                          <option value="sleeper_2x1">Sleeper 2 × 1</option>
                          <option value="1x1">1 × 1</option>
                        </select>
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            min={1}
                            max={30}
                            value={layoutRows}
                            onChange={(e) => setLayoutRows(Number(e.target.value))}
                            title="Rows"
                            className="h-8"
                          />
                          <Input
                            type="number"
                            min={1}
                            max={2}
                            value={layoutDecks}
                            onChange={(e) => setLayoutDecks(Number(e.target.value))}
                            title="Decks"
                            className="h-8"
                          />
                          <Input
                            type="number"
                            min={0}
                            max={10}
                            value={layoutLadiesRows}
                            onChange={(e) => setLayoutLadiesRows(Number(e.target.value))}
                            title="Ladies rows"
                            className="h-8"
                          />
                        </div>
                      </div>
                      <Button type="submit" size="sm" variant="secondary" className="w-full">
                        Apply Matrix Layout
                      </Button>
                    </form>

                    <SeatMap
                      seats={studioSeatsForMap}
                      selectedSeatIds={[]}
                      onSelectionChange={() => undefined}
                      readOnly
                    />

                    {/* Per-seat quick toggles */}
                    <div className="max-h-56 space-y-1.5 overflow-y-auto border-t pt-3">
                      <p className="text-xs font-semibold text-muted-foreground">
                        Per-Seat Policy & Hardware Status
                      </p>
                      {busDetailQuery.data.seats.map((seat) => (
                        <div
                          key={seat.id}
                          className="flex items-center justify-between rounded border px-2.5 py-1.5 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold">{seat.seat_number}</span>
                            <Badge variant="neutral" className="text-[10px]">
                              {seat.seat_type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleSeatAttribute(seat, {
                                  is_ladies_only: !seat.is_ladies_only,
                                })
                              }
                              className={`rounded border px-2 py-0.5 text-[11px] font-medium ${
                                seat.is_ladies_only
                                  ? "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-800"
                                  : "text-muted-foreground"
                              }`}
                            >
                              Ladies
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleSeatAttribute(seat, { is_active: !seat.is_active })
                              }
                              className={`rounded border px-2 py-0.5 text-[11px] font-medium ${
                                seat.is_active
                                  ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                                  : "border-rose-400 bg-rose-50 text-rose-800"
                              }`}
                            >
                              {seat.is_active ? "Active" : "Disabled"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB: DRIVERS */}
      {tab === "drivers" && (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">
                {editingDriver ? "Edit Driver" : "Add Driver"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveDriver} className="space-y-3">
                <div className="space-y-1">
                  <Label>Full Name</Label>
                  <Input required value={drvName} onChange={(e) => setDrvName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>License Number</Label>
                  <Input
                    required
                    value={drvLicense}
                    onChange={(e) => setDrvLicense(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input required value={drvPhone} onChange={(e) => setDrvPhone(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Exp. Years</Label>
                    <Input
                      type="number"
                      min={0}
                      value={drvExp}
                      onChange={(e) => setDrvExp(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Status</Label>
                    <select
                      value={drvStatus}
                      onChange={(e) => setDrvStatus(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
                    >
                      <option value="AVAILABLE">Available</option>
                      <option value="ON_TRIP">On Trip</option>
                      <option value="ON_LEAVE">On Leave</option>
                      <option value="SUSPENDED">Suspended</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    Save Driver
                  </Button>
                  {editingDriver && (
                    <Button type="button" variant="outline" onClick={() => setEditingDriver(null)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Driver Directory</CardTitle>
            </CardHeader>
            <CardContent>
              {driversQuery.isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <>
                  <div className="divide-y text-sm">
                    {(driversQuery.data?.results ?? []).map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-4 py-3">
                        <div>
                          <p className="font-semibold">{d.full_name}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {d.license_number} · {d.phone} · {d.experience_years}y exp
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={d.status} />
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Edit driver"
                            onClick={() => {
                              setEditingDriver(d);
                              setDrvName(d.full_name);
                              setDrvLicense(d.license_number);
                              setDrvPhone(d.phone);
                              setDrvExp(d.experience_years);
                              setDrvStatus(d.status);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Delete driver"
                            onClick={() => handleDeleteDriver(d.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {driversQuery.data && (
                    <PaginationBar
                      currentPage={driversQuery.data.current_page}
                      totalPages={driversQuery.data.total_pages}
                      totalCount={driversQuery.data.count}
                      pageSize={driversQuery.data.page_size}
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

      {/* TAB: CONDUCTORS */}
      {tab === "conductors" && (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">
                {editingConductor ? "Edit Conductor" : "Add Conductor"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveConductor} className="space-y-3">
                <div className="space-y-1">
                  <Label>Full Name</Label>
                  <Input required value={conName} onChange={(e) => setConName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Employee ID</Label>
                  <Input required value={conEmpId} onChange={(e) => setConEmpId(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input required value={conPhone} onChange={(e) => setConPhone(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <select
                    value={conStatus}
                    onChange={(e) => setConStatus(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
                  >
                    <option value="AVAILABLE">Available</option>
                    <option value="ON_TRIP">On Trip</option>
                    <option value="ON_LEAVE">On Leave</option>
                    <option value="SUSPENDED">Suspended</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    Save Conductor
                  </Button>
                  {editingConductor && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingConductor(null)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conductor Directory</CardTitle>
            </CardHeader>
            <CardContent>
              {conductorsQuery.isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <>
                  <div className="divide-y text-sm">
                    {(conductorsQuery.data?.results ?? []).map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-4 py-3">
                        <div>
                          <p className="font-semibold">{c.full_name}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {c.employee_id} · {c.phone}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={c.status} />
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Edit conductor"
                            onClick={() => {
                              setEditingConductor(c);
                              setConName(c.full_name);
                              setConEmpId(c.employee_id);
                              setConPhone(c.phone);
                              setConStatus(c.status);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Delete conductor"
                            onClick={() => handleDeleteConductor(c.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {conductorsQuery.data && (
                    <PaginationBar
                      currentPage={conductorsQuery.data.current_page}
                      totalPages={conductorsQuery.data.total_pages}
                      totalCount={conductorsQuery.data.count}
                      pageSize={conductorsQuery.data.page_size}
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
