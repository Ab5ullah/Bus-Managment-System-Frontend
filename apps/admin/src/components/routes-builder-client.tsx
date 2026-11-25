"use client";

import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, MapPin, Milestone, Pencil, Plus, Route as RouteIcon, Search, Trash2 } from "lucide-react";
import { ApiException, API_ENDPOINTS, normalizePaginated, type PaginatedData } from "@busms/api-client";
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
  Skeleton,
} from "@busms/ui";
import { adminFetch } from "@/lib/admin-api";

interface TerminalRecord {
  id: string;
  name: string;
  code: string;
  city: string;
  address: string;
  latitude: string | null;
  longitude: string | null;
  contact_number: string;
  is_active: boolean;
}

interface RouteSummary {
  id: string;
  code: string;
  name: string;
  origin: string;
  origin_city: string;
  destination: string;
  destination_city: string;
  total_distance_km: string;
  estimated_duration_minutes: number;
  stops_count: number;
  is_active: boolean;
}

interface RouteDetail extends RouteSummary {
  segments_count: number;
  stops: Array<{
    id: string;
    stop_order: number;
    terminal: string;
    terminal_name: string;
    terminal_code: string;
    terminal_city: string;
    distance_from_origin_km: string;
    offset_minutes: number;
  }>;
}

interface DraftStop {
  terminal: string;
  distance_from_origin_km: string;
  offset_minutes: number;
}

export function RoutesBuilderClient() {
  const { getValidAccessToken, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"routes" | "terminals">("routes");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Terminal form
  const [editingTerminal, setEditingTerminal] = useState<TerminalRecord | null>(null);
  const [termName, setTermName] = useState("");
  const [termCode, setTermCode] = useState("");
  const [termCity, setTermCity] = useState("");
  const [termAddr, setTermAddr] = useState("");
  const [termLat, setTermLat] = useState("");
  const [termLng, setTermLng] = useState("");
  const [termContact, setTermContact] = useState("");

  // Route form
  const [routeCode, setRouteCode] = useState("");
  const [routeName, setRouteName] = useState("");
  const [routeOrigin, setRouteOrigin] = useState("");
  const [routeDest, setRouteDest] = useState("");
  const [routeDist, setRouteDist] = useState("380");
  const [routeDur, setRouteDur] = useState("260");

  // Stop timeline editor
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [draftStops, setDraftStops] = useState<DraftStop[]>([]);

  const qs = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (search.trim()) qs.set("search", search.trim());

  const allTerminalsQuery = useQuery({
    queryKey: ["admin-all-terminals"],
    queryFn: async () => {
      const raw = await adminFetch<PaginatedData<TerminalRecord> | TerminalRecord[]>(
        `${API_ENDPOINTS.ROUTES.TERMINALS}?page=1&page_size=100`,
        getValidAccessToken
      );
      return normalizePaginated(raw, 100).results;
    },
    enabled: isAuthenticated,
  });

  const terminalsPageQuery = useQuery({
    queryKey: ["admin-terminals-page", page, pageSize, search],
    queryFn: async () => {
      const raw = await adminFetch<PaginatedData<TerminalRecord> | TerminalRecord[]>(
        `${API_ENDPOINTS.ROUTES.TERMINALS}?${qs.toString()}`,
        getValidAccessToken
      );
      return normalizePaginated(raw, pageSize);
    },
    enabled: isAuthenticated && tab === "terminals",
  });

  const routesPageQuery = useQuery({
    queryKey: ["admin-routes-page", page, pageSize, search],
    queryFn: async () => {
      const raw = await adminFetch<PaginatedData<RouteSummary> | RouteSummary[]>(
        `${API_ENDPOINTS.ROUTES.LIST}?${qs.toString()}`,
        getValidAccessToken
      );
      return normalizePaginated(raw, pageSize);
    },
    enabled: isAuthenticated && tab === "routes",
  });

  const routeDetailQuery = useQuery({
    queryKey: ["admin-route-detail", selectedRouteId],
    queryFn: () =>
      adminFetch<RouteDetail>(API_ENDPOINTS.ROUTES.detail(selectedRouteId!), getValidAccessToken),
    enabled: isAuthenticated && Boolean(selectedRouteId),
  });

  useEffect(() => {
    if (routeDetailQuery.data) {
      setDraftStops(
        routeDetailQuery.data.stops.map((s) => ({
          terminal: s.terminal,
          distance_from_origin_km: String(s.distance_from_origin_km),
          offset_minutes: s.offset_minutes,
        }))
      );
    }
  }, [routeDetailQuery.data]);

  const handleSaveTerminal = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const payload = {
        name: termName,
        code: termCode.toUpperCase(),
        city: termCity,
        address: termAddr,
        latitude: termLat ? termLat : null,
        longitude: termLng ? termLng : null,
        contact_number: termContact,
      };
      await adminFetch(
        editingTerminal
          ? API_ENDPOINTS.ROUTES.terminalDetail(editingTerminal.id)
          : API_ENDPOINTS.ROUTES.TERMINALS,
        getValidAccessToken,
        {
          method: editingTerminal ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      );
      setEditingTerminal(null);
      setTermName("");
      setTermCode("");
      setTermCity("");
      setTermAddr("");
      setTermLat("");
      setTermLng("");
      setTermContact("");
      setSuccessMsg("Terminal saved.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-terminals-page"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-all-terminals"] }),
      ]);
    } catch (err) {
      setErrorMsg(err instanceof ApiException ? err.message : "Failed to save terminal.");
    }
  };

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const created = await adminFetch<RouteDetail>(API_ENDPOINTS.ROUTES.LIST, getValidAccessToken, {
        method: "POST",
        body: JSON.stringify({
          code: routeCode.trim().toUpperCase(),
          name: routeName.trim(),
          origin: routeOrigin,
          destination: routeDest,
          total_distance_km: routeDist,
          estimated_duration_minutes: Number(routeDur),
        }),
      });
      setRouteCode("");
      setRouteName("");
      setSelectedRouteId(created.id);
      setSuccessMsg(`Route ${created.code} created.`);
      await queryClient.invalidateQueries({ queryKey: ["admin-routes-page"] });
    } catch (err) {
      setErrorMsg(err instanceof ApiException ? err.message : "Failed to create route.");
    }
  };

  const handleSaveStops = async () => {
    if (!selectedRouteId) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await adminFetch(
        API_ENDPOINTS.ROUTES.updateStops(selectedRouteId),
        getValidAccessToken,
        {
          method: "POST",
          body: JSON.stringify({
            stops: draftStops.map((s, idx) => ({
              terminal: s.terminal,
              stop_order: idx,
              distance_from_origin_km: s.distance_from_origin_km,
              offset_minutes: Number(s.offset_minutes),
            })),
          }),
        }
      );
      setSuccessMsg("Sequenced route stops saved.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-route-detail", selectedRouteId] }),
        queryClient.invalidateQueries({ queryKey: ["admin-routes-page"] }),
      ]);
    } catch (err) {
      setErrorMsg(err instanceof ApiException ? err.message : "Failed to update stops.");
    }
  };

  const moveStop = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= draftStops.length) return;
    const copy = [...draftStops];
    const [removed] = copy.splice(index, 1);
    if (removed) {
      copy.splice(target, 0, removed);
      setDraftStops(copy);
    }
  };

  const terminals = allTerminalsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Terminals & Corridor Builder</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage physical stations, GPS coordinates, and ordered intermediate stops along corridors.
          </p>
        </div>

        <div className="flex gap-1 rounded-lg border bg-card p-1">
          {[
            { key: "routes", label: "Sequenced Routes", icon: RouteIcon },
            { key: "terminals", label: "Terminals", icon: MapPin },
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

      {/* TAB: SEQUENCED ROUTES */}
      {tab === "routes" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_460px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Create Corridor Route</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateRoute} className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label>Code</Label>
                    <Input
                      required
                      placeholder="LHR-ISB-M2"
                      value={routeCode}
                      onChange={(e) => setRouteCode(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Corridor Name</Label>
                    <Input
                      required
                      placeholder="Lahore to Islamabad via M2"
                      value={routeName}
                      onChange={(e) => setRouteName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Origin Terminal</Label>
                    <select
                      required
                      value={routeOrigin}
                      onChange={(e) => setRouteOrigin(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
                    >
                      <option value="">Select origin...</option>
                      {terminals.map((term) => (
                        <option key={term.id} value={term.id}>
                          {term.city} — {term.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Destination Terminal</Label>
                    <select
                      required
                      value={routeDest}
                      onChange={(e) => setRouteDest(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-card px-2 text-sm"
                    >
                      <option value="">Select destination...</option>
                      {terminals.map((term) => (
                        <option key={term.id} value={term.id}>
                          {term.city} — {term.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Km</Label>
                      <Input
                        type="number"
                        value={routeDist}
                        onChange={(e) => setRouteDist(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Mins</Label>
                      <Input
                        type="number"
                        value={routeDur}
                        onChange={(e) => setRouteDur(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-3">
                    <Button type="submit" size="sm">
                      <Plus className="h-4 w-4" />
                      <span>Create Route</span>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active Corridors</CardTitle>
              </CardHeader>
              <CardContent>
                {routesPageQuery.isLoading ? (
                  <Skeleton className="h-48" />
                ) : (
                  <>
                    <div className="divide-y text-sm">
                      {(routesPageQuery.data?.results ?? []).map((r) => (
                        <div
                          key={r.id}
                          className={`flex items-center justify-between gap-3 py-3 ${
                            selectedRouteId === r.id ? "bg-primary/5 px-2 rounded" : ""
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="neutral" className="font-mono text-[11px]">
                                {r.code}
                              </Badge>
                              <span className="font-semibold">
                                {r.origin_city} → {r.destination_city}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {r.name} · {r.stops_count} stops · {Math.round(Number(r.total_distance_km))} km
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant={selectedRouteId === r.id ? "default" : "outline"}
                            onClick={() => setSelectedRouteId(r.id)}
                          >
                            Edit Stops
                          </Button>
                        </div>
                      ))}
                    </div>

                    {routesPageQuery.data && (
                      <PaginationBar
                        currentPage={routesPageQuery.data.current_page}
                        totalPages={routesPageQuery.data.total_pages}
                        totalCount={routesPageQuery.data.count}
                        pageSize={routesPageQuery.data.page_size}
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

          {/* Visual Ordered Stop Timeline Editor */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Milestone className="h-4 w-4 text-primary" />
                <span>Stop Sequence Editor</span>
              </CardTitle>
              <CardDescription>
                {routeDetailQuery.data
                  ? `${routeDetailQuery.data.code} (${routeDetailQuery.data.segments_count} directional segments)`
                  : "Select a corridor route to edit its ordered stop sequence."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedRouteId && (
                <>
                  <div className="space-y-3">
                    {draftStops.map((stop, idx) => (
                      <div key={`${stop.terminal}-${idx}`} className="rounded-lg border bg-background p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="default" className="font-mono text-[11px]">
                            Stop #{idx}
                          </Badge>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={idx === 0}
                              onClick={() => moveStop(idx, -1)}
                              aria-label="Move stop up"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={idx === draftStops.length - 1}
                              onClick={() => moveStop(idx, 1)}
                              aria-label="Move stop down"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={draftStops.length <= 2}
                              onClick={() =>
                                setDraftStops((prev) => prev.filter((_, i) => i !== idx))
                              }
                              aria-label="Remove stop"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>

                        <select
                          value={stop.terminal}
                          onChange={(e) => {
                            const next = [...draftStops];
                            next[idx] = { ...stop, terminal: e.target.value };
                            setDraftStops(next);
                          }}
                          className="flex h-9 w-full rounded border border-input bg-card px-2 text-xs"
                        >
                          {terminals.map((term) => (
                            <option key={term.id} value={term.id}>
                              {term.city} — {term.name} ({term.code})
                            </option>
                          ))}
                        </select>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <Label className="text-[11px]">Distance (km)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={stop.distance_from_origin_km}
                              onChange={(e) => {
                                const next = [...draftStops];
                                next[idx] = { ...stop, distance_from_origin_km: e.target.value };
                                setDraftStops(next);
                              }}
                              className="h-8 font-mono"
                            />
                          </div>
                          <div>
                            <Label className="text-[11px]">Offset (mins)</Label>
                            <Input
                              type="number"
                              value={stop.offset_minutes}
                              onChange={(e) => {
                                const next = [...draftStops];
                                next[idx] = { ...stop, offset_minutes: Number(e.target.value) };
                                setDraftStops(next);
                              }}
                              className="h-8 font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={terminals.length === 0}
                      onClick={() => {
                        const last = draftStops[draftStops.length - 1];
                        setDraftStops([
                          ...draftStops,
                          {
                            terminal: terminals[0]?.id || "",
                            distance_from_origin_km: last
                              ? String(Number(last.distance_from_origin_km) + 50)
                              : "0",
                            offset_minutes: last ? last.offset_minutes + 30 : 0,
                          },
                        ]);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Stop</span>
                    </Button>
                    <Button type="button" size="sm" className="flex-1" onClick={handleSaveStops}>
                      Save Stop Sequence
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB: TERMINALS */}
      {tab === "terminals" && (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">
                {editingTerminal ? `Edit ${editingTerminal.code}` : "Create Terminal"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveTerminal} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Code</Label>
                    <Input
                      required
                      placeholder="LHR-THK"
                      value={termCode}
                      onChange={(e) => setTermCode(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>City</Label>
                    <Input
                      required
                      placeholder="Lahore"
                      value={termCity}
                      onChange={(e) => setTermCity(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Terminal Name</Label>
                  <Input
                    required
                    placeholder="Thokar Niaz Baig Terminal"
                    value={termName}
                    onChange={(e) => setTermName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Address</Label>
                  <Input value={termAddr} onChange={(e) => setTermAddr(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Latitude</Label>
                    <Input
                      placeholder="31.4697"
                      value={termLat}
                      onChange={(e) => setTermLat(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Longitude</Label>
                    <Input
                      placeholder="74.2728"
                      value={termLng}
                      onChange={(e) => setTermLng(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Contact Number</Label>
                  <Input value={termContact} onChange={(e) => setTermContact(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    Save Terminal
                  </Button>
                  {editingTerminal && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingTerminal(null)}
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
              <CardTitle className="text-base">Terminal Directory</CardTitle>
            </CardHeader>
            <CardContent>
              {terminalsPageQuery.isLoading ? (
                <Skeleton className="h-56" />
              ) : (
                <>
                  <div className="divide-y text-sm">
                    {(terminalsPageQuery.data?.results ?? []).map((term) => (
                      <div key={term.id} className="flex items-center justify-between gap-3 py-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="neutral" className="font-mono text-[11px]">
                              {term.code}
                            </Badge>
                            <span className="font-semibold">{term.name}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {term.city}
                            {term.latitude && term.longitude
                              ? ` · GPS ${term.latitude}, ${term.longitude}`
                              : ""}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Edit terminal"
                          onClick={() => {
                            setEditingTerminal(term);
                            setTermName(term.name);
                            setTermCode(term.code);
                            setTermCity(term.city);
                            setTermAddr(term.address || "");
                            setTermLat(term.latitude || "");
                            setTermLng(term.longitude || "");
                            setTermContact(term.contact_number || "");
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {terminalsPageQuery.data && (
                    <PaginationBar
                      currentPage={terminalsPageQuery.data.current_page}
                      totalPages={terminalsPageQuery.data.total_pages}
                      totalCount={terminalsPageQuery.data.count}
                      pageSize={terminalsPageQuery.data.page_size}
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
