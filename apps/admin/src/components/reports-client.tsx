"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  TrendingUp,
  Users,
  MapPin,
  Download,
  RefreshCcw,
  Calendar,
  DollarSign,
  Percent,
  Award,
} from "lucide-react";
import {
  Button,
  Card,
  Input,
  Label,
  Skeleton,
  Alert,
  formatCurrencyPkr,
} from "@busms/ui";
import { useAuth } from "@busms/api-client/auth";
import { API_ENDPOINTS } from "@busms/config/endpoints";
import { adminFetch, formatShortDateTime } from "@/lib/admin-api";

// ─── Types (aligned with D:\Bus ticket\apps\reports\services.py) ─────────────

interface RevenueSeriesItem {
  period: string;
  bookings_count: number;
  total_collected: string;
  refunds_issued: string;
  net_revenue: string;
}

interface RevenueReport {
  group_by: string;
  start_date: string | null;
  end_date: string | null;
  summary: {
    bookings_count: number;
    gross_fare: string;
    discounts: string;
    tax_collected: string;
    service_fees: string;
    total_collected: string;
    refunds_issued: string;
    net_revenue: string;
  };
  series: RevenueSeriesItem[];
}

interface OccupancyTrip {
  trip_id: string;
  trip_number: string;
  route_code: string;
  route_name: string;
  bus_registration: string;
  departure_datetime: string;
  status: string;
  bus_capacity: number;
  booked_segments_count: number;
  route_distance_km: string;
  passenger_km: string;
  seat_km: string;
  load_factor_percentage: string | number;
}

interface OccupancyReport {
  summary: {
    trips_evaluated: number;
    total_passenger_km: string;
    total_seat_km: string;
    overall_load_factor_percentage: string | number;
  };
  trips: OccupancyTrip[];
}

interface RoutePerf {
  route_id: string;
  route_code: string;
  route_name: string;
  seats_sold: number;
  fare_revenue: string;
}

interface RoutePerformanceReport {
  top_routes: RoutePerf[];
  peak_travel_hours: Array<{
    hour: string;
    passengers: number;
    fare_revenue: string;
  }>;
}

interface AgentSale {
  agent_id: string;
  agent_name: string;
  agent_phone: string;
  bookings_count: number;
  seats_sold: number;
  gross_sales: string;
  commission_earned: string;
}

interface AgentSalesReport {
  commission_rate_percentage: string;
  summary: {
    total_agents: number;
    total_gross_sales: string;
    total_commissions_payable: string;
  };
  agents: AgentSale[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPct(val: number | string | null | undefined) {
  if (val == null) return "—";
  return `${Number(val).toFixed(1)}%`;
}

function nMonthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Mini bar chart (pure CSS) ────────────────────────────────────────────────

function BarChartMini({ data }: { data: { label: string; value: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex h-28 items-end gap-1 overflow-x-auto pb-5">
      {data.map((d, i) => (
        <div key={i} className="group flex min-w-[20px] flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-primary/70 transition-all group-hover:bg-primary"
            style={{ height: `${Math.max(4, (d.value / max) * 96)}px` }}
            title={`${d.label}: ${d.value}`}
          />
          <span className="max-w-[40px] overflow-hidden text-ellipsis whitespace-nowrap text-[9px] text-muted-foreground">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Occupancy gauge ─────────────────────────────────────────────────────────

function OccupancyGauge({ pct }: { pct: number }) {
  const safePct = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
  const color =
    safePct >= 80 ? "text-green-600" : safePct >= 50 ? "text-amber-600" : "text-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-10 w-10 shrink-0">
        <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            strokeWidth="3"
            strokeDasharray={`${(safePct / 100) * 94} 94`}
            className={color}
            stroke="currentColor"
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold ${color}`}>
          {safePct.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

type ReportTab = "revenue" | "occupancy" | "routes" | "agents";

export function ReportsClient() {
  const t = useTranslations();
  const { getValidAccessToken: getToken } = useAuth();

  const [tab, setTab] = useState<ReportTab>("revenue");
  const [startDate, setStartDate] = useState(nMonthsAgo(1));
  const [endDate, setEndDate] = useState(todayStr());
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");

  // ── Revenue ──
  const revenueQuery = useQuery({
    queryKey: ["reports-revenue", startDate, endDate, groupBy],
    queryFn: () =>
      adminFetch<RevenueReport>(
        `${API_ENDPOINTS.ADMIN_REPORTS.REVENUE}?start_date=${startDate}&end_date=${endDate}&group_by=${groupBy}`,
        getToken
      ),
    enabled: tab === "revenue",
    staleTime: 60_000,
  });

  // ── Occupancy ──
  const occupancyQuery = useQuery({
    queryKey: ["reports-occupancy", startDate, endDate],
    queryFn: () =>
      adminFetch<OccupancyReport>(
        `${API_ENDPOINTS.ADMIN_REPORTS.OCCUPANCY}?start_date=${startDate}&end_date=${endDate}`,
        getToken
      ),
    enabled: tab === "occupancy",
    staleTime: 60_000,
  });

  // ── Route performance ──
  const routeQuery = useQuery({
    queryKey: ["reports-routes", startDate, endDate],
    queryFn: () =>
      adminFetch<RoutePerformanceReport>(
        `${API_ENDPOINTS.ADMIN_REPORTS.ROUTE_PERFORMANCE}?start_date=${startDate}&end_date=${endDate}`,
        getToken
      ),
    enabled: tab === "routes",
    staleTime: 60_000,
  });

  // ── Agent sales ──
  const agentQuery = useQuery({
    queryKey: ["reports-agents", startDate, endDate],
    queryFn: () =>
      adminFetch<AgentSalesReport>(
        `${API_ENDPOINTS.ADMIN_REPORTS.AGENT_SALES}?start_date=${startDate}&end_date=${endDate}`,
        getToken
      ),
    enabled: tab === "agents",
    staleTime: 60_000,
  });

  // ── Export handler ──
  const handleExport = async (type: string, format: "csv" | "xlsx") => {
    try {
      const token = await getToken();
      const baseUrl =
        process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
      const url = `${baseUrl}${API_ENDPOINTS.ADMIN_REPORTS.EXPORT}?type=${type}&format=${format}&start_date=${startDate}&end_date=${endDate}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${type}_${startDate}_${endDate}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch {
      // ignore
    }
  };

  const currentQuery = {
    revenue: revenueQuery,
    occupancy: occupancyQuery,
    routes: routeQuery,
    agents: agentQuery,
  }[tab];

  const isLoading = currentQuery.isLoading;
  const isError = currentQuery.isError;

  const revSummary = revenueQuery.data?.summary;
  const revSeries = revenueQuery.data?.series ?? [];
  const occSummary = occupancyQuery.data?.summary;
  const occTrips = occupancyQuery.data?.trips ?? [];
  const topRoutes = routeQuery.data?.top_routes ?? [];
  const agentList = agentQuery.data?.agents ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("reports.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("reports.subtitle")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => currentQuery.refetch()}
          disabled={isLoading}
        >
          <RefreshCcw className="me-2 h-4 w-4" />
          {t("reports.refresh")}
        </Button>
      </div>

      {/* Date range filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <Calendar className="h-3.5 w-3.5" /> {t("reports.startDate")}
            </Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <Calendar className="h-3.5 w-3.5" /> {t("reports.endDate")}
            </Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40"
            />
          </div>
          {tab === "revenue" && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t("reports.groupBy")}</Label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="day">{t("reports.byDay")}</option>
                <option value="week">{t("reports.byWeek")}</option>
                <option value="month">{t("reports.byMonth")}</option>
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setStartDate(nMonthsAgo(1)); setEndDate(todayStr()); }}
            >
              {t("reports.last30Days")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setStartDate(nMonthsAgo(3)); setEndDate(todayStr()); }}
            >
              {t("reports.last90Days")}
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
        {(
          [
            { id: "revenue", icon: DollarSign, label: t("reports.tabRevenue") },
            { id: "occupancy", icon: Percent, label: t("reports.tabOccupancy") },
            { id: "routes", icon: MapPin, label: t("reports.tabRoutes") },
            { id: "agents", icon: Users, label: t("reports.tabAgents") },
          ] as { id: ReportTab; icon: React.ComponentType<{ className?: string }>; label: string }[]
        ).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === id
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {isError && (
        <Alert variant="danger">
          <span>{t("reports.fetchError")}</span>
        </Alert>
      )}

      {/* ═══ REVENUE TAB ══════════════════════════════════════════════════════ */}
      {tab === "revenue" && (
        <div className="space-y-5">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : revenueQuery.data ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    icon: DollarSign,
                    label: t("reports.totalRevenue"),
                    value: formatCurrencyPkr(Number(revSummary?.net_revenue ?? 0)),
                    color: "text-green-600",
                  },
                  {
                    icon: BarChart3,
                    label: t("reports.totalBookings"),
                    value: Number(revSummary?.bookings_count ?? 0).toLocaleString(),
                    color: "text-blue-600",
                  },
                  {
                    icon: TrendingUp,
                    label: "Total Collected",
                    value: formatCurrencyPkr(Number(revSummary?.total_collected ?? 0)),
                    color: "text-primary",
                  },
                  {
                    icon: Award,
                    label: "Refunds Issued",
                    value: formatCurrencyPkr(Number(revSummary?.refunds_issued ?? 0)),
                    color: "text-purple-600",
                  },
                ].map(({ icon: Icon, label, value, color }) => (
                  <Card key={label} className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className={`mt-1.5 text-2xl font-bold ${color}`}>{value}</p>
                      </div>
                      <div className={`rounded-md p-2 ${color} bg-current/10`}>
                        <Icon className="h-5 w-5" style={{ color: "currentColor" }} />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {revSeries.length > 0 && (
                <Card className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-semibold">{t("reports.revenueChart")}</h2>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExport("revenue", "csv")}
                      >
                        <Download className="me-1.5 h-3.5 w-3.5" />
                        CSV
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExport("revenue", "xlsx")}
                      >
                        <Download className="me-1.5 h-3.5 w-3.5" />
                        Excel
                      </Button>
                    </div>
                  </div>
                  <BarChartMini
                    data={revSeries.map((g) => ({
                      label: String(g.period).slice(0, 10),
                      value: Number(g.net_revenue ?? 0),
                    }))}
                  />
                </Card>
              )}

              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                        <th className="px-4 py-3 text-start font-medium">{t("reports.period")}</th>
                        <th className="px-4 py-3 text-end font-medium">{t("reports.bookings")}</th>
                        <th className="px-4 py-3 text-end font-medium">Collected</th>
                        <th className="px-4 py-3 text-end font-medium">Refunds</th>
                        <th className="px-4 py-3 text-end font-medium">{t("reports.revenue")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {revSeries.map((g) => (
                        <tr key={g.period} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs">{String(g.period).slice(0, 10)}</td>
                          <td className="px-4 py-3 text-end">{g.bookings_count}</td>
                          <td className="px-4 py-3 text-end">
                            {formatCurrencyPkr(Number(g.total_collected ?? 0))}
                          </td>
                          <td className="px-4 py-3 text-end text-muted-foreground">
                            {formatCurrencyPkr(Number(g.refunds_issued ?? 0))}
                          </td>
                          <td className="px-4 py-3 text-end font-medium text-green-600">
                            {formatCurrencyPkr(Number(g.net_revenue ?? 0))}
                          </td>
                        </tr>
                      ))}
                      {revSeries.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                            No revenue records in this date range.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : null}
        </div>
      )}

      {/* ═══ OCCUPANCY TAB ════════════════════════════════════════════════════ */}
      {tab === "occupancy" && (
        <div className="space-y-5">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : occupancyQuery.data ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="p-5">
                  <p className="text-xs text-muted-foreground">{t("reports.avgOccupancy")}</p>
                  <div className="mt-3 flex items-center gap-4">
                    <OccupancyGauge pct={Number(occSummary?.overall_load_factor_percentage ?? 0)} />
                    <p className="text-3xl font-bold">
                      {formatPct(occSummary?.overall_load_factor_percentage)}
                    </p>
                  </div>
                </Card>
                <Card className="p-5">
                  <p className="text-xs text-muted-foreground">{t("reports.tripsAnalyzed")}</p>
                  <p className="mt-3 text-3xl font-bold">
                    {occSummary?.trips_evaluated ?? 0}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport("occupancy", "csv")}
                    >
                      <Download className="me-1.5 h-3.5 w-3.5" /> CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport("occupancy", "xlsx")}
                    >
                      <Download className="me-1.5 h-3.5 w-3.5" /> Excel
                    </Button>
                  </div>
                </Card>
              </div>

              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                        <th className="px-4 py-3 text-start font-medium">{t("reports.tripId")}</th>
                        <th className="px-4 py-3 text-start font-medium">{t("reports.route")}</th>
                        <th className="px-4 py-3 text-start font-medium">{t("reports.departure")}</th>
                        <th className="px-4 py-3 text-end font-medium">{t("reports.seats")}</th>
                        <th className="px-4 py-3 text-end font-medium">{t("reports.booked")}</th>
                        <th className="px-4 py-3 text-end font-medium">{t("reports.loadFactor")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {occTrips.map((trip) => {
                        const lf = Number(trip.load_factor_percentage ?? 0);
                        return (
                          <tr key={trip.trip_id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs">{trip.trip_number}</td>
                            <td className="px-4 py-3 font-medium">{trip.route_code}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {formatShortDateTime(trip.departure_datetime)}
                            </td>
                            <td className="px-4 py-3 text-end">{trip.bus_capacity}</td>
                            <td className="px-4 py-3 text-end">{trip.booked_segments_count}</td>
                            <td className="px-4 py-3 text-end">
                              <div className="flex items-center justify-end gap-2">
                                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className={`h-full rounded-full ${
                                      lf >= 80
                                        ? "bg-green-500"
                                        : lf >= 50
                                        ? "bg-amber-500"
                                        : "bg-red-400"
                                    }`}
                                    style={{ width: `${Math.min(100, lf)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium">{formatPct(lf)}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {occTrips.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                            No trips evaluated in this date range.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : null}
        </div>
      )}

      {/* ═══ ROUTE PERFORMANCE TAB ════════════════════════════════════════════ */}
      {tab === "routes" && (
        <div className="space-y-5">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : routeQuery.data ? (
            <>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("route-performance", "csv")}
                >
                  <Download className="me-1.5 h-3.5 w-3.5" /> CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("route-performance", "xlsx")}
                >
                  <Download className="me-1.5 h-3.5 w-3.5" /> Excel
                </Button>
              </div>

              {topRoutes.length > 0 && (
                <Card className="p-5">
                  <h2 className="mb-3 font-semibold">{t("reports.revenueByRoute")}</h2>
                  <BarChartMini
                    data={topRoutes.slice(0, 10).map((r) => ({
                      label: r.route_code,
                      value: Number(r.fare_revenue ?? 0),
                    }))}
                  />
                </Card>
              )}

              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                        <th className="px-4 py-3 text-start font-medium">{t("reports.route")}</th>
                        <th className="px-4 py-3 text-start font-medium">{t("reports.corridor")}</th>
                        <th className="px-4 py-3 text-end font-medium">{t("reports.seats")}</th>
                        <th className="px-4 py-3 text-end font-medium">{t("reports.revenue")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {topRoutes.map((r, i) => (
                        <tr key={r.route_id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {i < 3 && (
                                <Award
                                  className={`h-4 w-4 ${
                                    i === 0
                                      ? "text-yellow-500"
                                      : i === 1
                                      ? "text-slate-400"
                                      : "text-amber-700"
                                  }`}
                                />
                              )}
                              <span className="font-mono font-medium">{r.route_code}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{r.route_name}</td>
                          <td className="px-4 py-3 text-end">{r.seats_sold}</td>
                          <td className="px-4 py-3 text-end font-medium text-green-600">
                            {formatCurrencyPkr(Number(r.fare_revenue ?? 0))}
                          </td>
                        </tr>
                      ))}
                      {topRoutes.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                            No route performance data in this date range.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : null}
        </div>
      )}

      {/* ═══ AGENT SALES TAB ══════════════════════════════════════════════════ */}
      {tab === "agents" && (
        <div className="space-y-5">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : agentQuery.data ? (
            <>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {agentQuery.data.summary?.total_agents ?? agentList.length}{" "}
                  {t("reports.agentsInPeriod")}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport("agent-sales", "csv")}
                  >
                    <Download className="me-1.5 h-3.5 w-3.5" /> CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport("agent-sales", "xlsx")}
                  >
                    <Download className="me-1.5 h-3.5 w-3.5" /> Excel
                  </Button>
                </div>
              </div>

              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                        <th className="px-4 py-3 text-start font-medium">#</th>
                        <th className="px-4 py-3 text-start font-medium">{t("reports.agent")}</th>
                        <th className="px-4 py-3 text-start font-medium">{t("reports.phone")}</th>
                        <th className="px-4 py-3 text-end font-medium">{t("reports.bookings")}</th>
                        <th className="px-4 py-3 text-end font-medium">{t("reports.seats")}</th>
                        <th className="px-4 py-3 text-end font-medium">{t("reports.revenue")}</th>
                        <th className="px-4 py-3 text-end font-medium">Commission</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {agentList.map((agent, i) => (
                        <tr key={agent.agent_id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-3 font-medium">{agent.agent_name}</td>
                          <td className="px-4 py-3 font-mono text-xs">{agent.agent_phone}</td>
                          <td className="px-4 py-3 text-end">{agent.bookings_count}</td>
                          <td className="px-4 py-3 text-end">{agent.seats_sold}</td>
                          <td className="px-4 py-3 text-end font-medium text-green-600">
                            {formatCurrencyPkr(Number(agent.gross_sales ?? 0))}
                          </td>
                          <td className="px-4 py-3 text-end text-muted-foreground">
                            {formatCurrencyPkr(Number(agent.commission_earned ?? 0))}
                          </td>
                        </tr>
                      ))}
                      {agentList.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                            {t("reports.noAgents")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
