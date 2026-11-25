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
  Badge,
  formatCurrencyPkr,
} from "@busms/ui";
import { useAuth } from "@busms/api-client/auth";
import { adminFetch, formatShortDateTime } from "@/lib/admin-api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RevenueGroup {
  period: string;
  total_revenue: string;
  booking_count: number;
  ticket_count: number;
  avg_fare: string;
}

interface RevenueReport {
  total_revenue: string;
  total_bookings: number;
  total_tickets: number;
  avg_fare_per_ticket: string;
  by_period: RevenueGroup[];
  start_date: string;
  end_date: string;
}

interface OccupancyTrip {
  trip_id: string;
  route_code: string;
  departure_datetime: string;
  total_seats: number;
  booked_seats: number;
  occupancy_pct: number;
}

interface OccupancyReport {
  avg_occupancy_pct: number;
  total_trips_analyzed: number;
  trips: OccupancyTrip[];
}

interface RoutePerf {
  route_code: string;
  origin_city: string;
  destination_city: string;
  total_bookings: number;
  total_revenue: string;
  avg_occupancy_pct: number;
  peak_hour: number | null;
}

interface RoutePerformanceReport {
  top_routes: RoutePerf[];
  date_range: { start: string; end: string };
}

interface AgentSale {
  agent_id: string;
  agent_name: string;
  phone: string;
  total_bookings: number;
  total_revenue: string;
  total_tickets: number;
}

interface AgentSalesReport {
  agents: AgentSale[];
  total_agents: number;
  date_range: { start: string; end: string };
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
            style={{ height: `${(d.value / max) * 96}px` }}
            title={`${d.label}: ${d.value}`}
          />
          <span className="max-w-[32px] overflow-hidden text-ellipsis whitespace-nowrap text-[9px] text-muted-foreground">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Occupancy gauge ─────────────────────────────────────────────────────────

function OccupancyGauge({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-500";
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
            strokeDasharray={`${(pct / 100) * 94} 94`}
            className={color}
            stroke="currentColor"
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold ${color}`}>
          {pct.toFixed(0)}%
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
        `/api/admin/reports/revenue/?start_date=${startDate}&end_date=${endDate}&group_by=${groupBy}`,
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
        `/api/admin/reports/occupancy/?start_date=${startDate}&end_date=${endDate}`,
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
        `/api/admin/reports/route-performance/?start_date=${startDate}&end_date=${endDate}`,
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
        `/api/admin/reports/agent-sales/?start_date=${startDate}&end_date=${endDate}`,
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
      const url = `${baseUrl}/api/admin/reports/export/?type=${type}&format=${format}&start_date=${startDate}&end_date=${endDate}`;
      const link = document.createElement("a");
      link.href = url;
      link.download = `${type}_${startDate}_${endDate}.${format}`;
      // Attach auth header via fetch + blob
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Show inline error
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

  // ─── RENDER ───────────────────────────────────────────────────────────────

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
              {/* KPI Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    icon: DollarSign,
                    label: t("reports.totalRevenue"),
                    value: formatCurrencyPkr(Number(revenueQuery.data.total_revenue)),
                    color: "text-green-600",
                  },
                  {
                    icon: BarChart3,
                    label: t("reports.totalBookings"),
                    value: revenueQuery.data.total_bookings.toLocaleString(),
                    color: "text-blue-600",
                  },
                  {
                    icon: TrendingUp,
                    label: t("reports.totalTickets"),
                    value: revenueQuery.data.total_tickets.toLocaleString(),
                    color: "text-primary",
                  },
                  {
                    icon: Award,
                    label: t("reports.avgFare"),
                    value: formatCurrencyPkr(Number(revenueQuery.data.avg_fare_per_ticket)),
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

              {/* Chart */}
              {revenueQuery.data.by_period.length > 0 && (
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
                    data={revenueQuery.data.by_period.map((g) => ({
                      label: g.period.slice(5), // "MM-DD"
                      value: Number(g.total_revenue),
                    }))}
                  />
                </Card>
              )}

              {/* Period table */}
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                        <th className="px-4 py-3 text-start font-medium">{t("reports.period")}</th>
                        <th className="px-4 py-3 text-end font-medium">{t("reports.revenue")}</th>
                        <th className="px-4 py-3 text-end font-medium">{t("reports.bookings")}</th>
                        <th className="px-4 py-3 text-end font-medium">{t("reports.tickets")}</th>
                        <th className="px-4 py-3 text-end font-medium">{t("reports.avgFare")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {revenueQuery.data.by_period.map((g) => (
                        <tr key={g.period} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs">{g.period}</td>
                          <td className="px-4 py-3 text-end font-medium text-green-600">
                            {formatCurrencyPkr(Number(g.total_revenue))}
                          </td>
                          <td className="px-4 py-3 text-end">{g.booking_count}</td>
                          <td className="px-4 py-3 text-end">{g.ticket_count}</td>
                          <td className="px-4 py-3 text-end text-muted-foreground">
                            {formatCurrencyPkr(Number(g.avg_fare))}
                          </td>
                        </tr>
                      ))}
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
                    <OccupancyGauge pct={occupancyQuery.data.avg_occupancy_pct} />
                    <p className="text-3xl font-bold">
                      {formatPct(occupancyQuery.data.avg_occupancy_pct)}
                    </p>
                  </div>
                </Card>
                <Card className="p-5">
                  <p className="text-xs text-muted-foreground">{t("reports.tripsAnalyzed")}</p>
                  <p className="mt-3 text-3xl font-bold">
                    {occupancyQuery.data.total_trips_analyzed}
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
                      {occupancyQuery.data.trips.map((trip) => (
                        <tr key={trip.trip_id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs">
                            {trip.trip_id.slice(0, 8)}…
                          </td>
                          <td className="px-4 py-3 font-medium">{trip.route_code}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {formatShortDateTime(trip.departure_datetime)}
                          </td>
                          <td className="px-4 py-3 text-end">{trip.total_seats}</td>
                          <td className="px-4 py-3 text-end">{trip.booked_seats}</td>
                          <td className="px-4 py-3 text-end">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                <div
                                  className={`h-full rounded-full ${
                                    trip.occupancy_pct >= 80
                                      ? "bg-green-500"
                                      : trip.occupancy_pct >= 50
                                      ? "bg-amber-500"
                                      : "bg-red-400"
                                  }`}
                                  style={{ width: `${trip.occupancy_pct}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium">
                                {formatPct(trip.occupancy_pct)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
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

              {/* Top revenue chart */}
              {routeQuery.data.top_routes.length > 0 && (
                <Card className="p-5">
                  <h2 className="mb-3 font-semibold">{t("reports.revenueByRoute")}</h2>
                  <BarChartMini
                    data={routeQuery.data.top_routes.slice(0, 10).map((r) => ({
                      label: r.route_code,
                      value: Number(r.total_revenue),
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
                        <th className="px-4 py-3 text-end font-medium">{t("reports.bookings")}</th>
                        <th className="px-4 py-3 text-end font-medium">{t("reports.revenue")}</th>
                        <th className="px-4 py-3 text-end font-medium">{t("reports.loadFactor")}</th>
                        <th className="px-4 py-3 text-end font-medium">{t("reports.peakHour")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {routeQuery.data.top_routes.map((r, i) => (
                        <tr key={r.route_code} className="hover:bg-muted/30 transition-colors">
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
                          <td className="px-4 py-3 text-muted-foreground">
                            {r.origin_city} → {r.destination_city}
                          </td>
                          <td className="px-4 py-3 text-end">{r.total_bookings}</td>
                          <td className="px-4 py-3 text-end font-medium text-green-600">
                            {formatCurrencyPkr(Number(r.total_revenue))}
                          </td>
                          <td className="px-4 py-3 text-end">
                            <Badge
                              variant={
                                r.avg_occupancy_pct >= 80
                                  ? "success"
                                  : r.avg_occupancy_pct >= 50
                                  ? "warning"
                                  : "neutral"
                              }
                              className="text-xs"
                            >
                              {formatPct(r.avg_occupancy_pct)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-end text-muted-foreground">
                            {r.peak_hour != null ? `${r.peak_hour}:00` : "—"}
                          </td>
                        </tr>
                      ))}
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
                  {agentQuery.data.total_agents} {t("reports.agentsInPeriod")}
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
                        <th className="px-4 py-3 text-end font-medium">{t("reports.tickets")}</th>
                        <th className="px-4 py-3 text-end font-medium">{t("reports.revenue")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {agentQuery.data.agents.map((agent, i) => (
                        <tr key={agent.agent_id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-3 font-medium">{agent.agent_name}</td>
                          <td className="px-4 py-3 font-mono text-xs">{agent.phone}</td>
                          <td className="px-4 py-3 text-end">{agent.total_bookings}</td>
                          <td className="px-4 py-3 text-end">{agent.total_tickets}</td>
                          <td className="px-4 py-3 text-end font-medium text-green-600">
                            {formatCurrencyPkr(Number(agent.total_revenue))}
                          </td>
                        </tr>
                      ))}
                      {agentQuery.data.agents.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
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
