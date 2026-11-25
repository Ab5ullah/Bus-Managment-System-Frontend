"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  Bus,
  CalendarClock,
  DollarSign,
  MapPin,
  QrCode,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";
import { useAuth } from "@busms/api-client/auth";
import { API_ENDPOINTS } from "@busms/config/endpoints";
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
  Skeleton,
  formatCurrencyPkr,
} from "@busms/ui";
import { Link } from "@/i18n/routing";
import { adminFetch } from "@/lib/admin-api";

interface RevenueReport {
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
  series: Array<{
    period: string;
    bookings_count: number;
    total_collected: string;
    refunds_issued: string;
    net_revenue: string;
  }>;
}

interface OccupancyReport {
  summary: {
    trips_evaluated: number;
    total_passenger_km: string;
    total_seat_km: string;
    overall_load_factor_percentage: string;
  };
}

interface RoutePerformanceReport {
  top_routes: Array<{
    route_id: string;
    route_code: string;
    route_name: string;
    seats_sold: number;
    fare_revenue: string;
  }>;
  peak_travel_hours: Array<{
    hour: string;
    passengers: number;
    fare_revenue: string;
  }>;
}

interface AgentSalesReport {
  commission_rate_percentage: string;
  summary: {
    total_agents: number;
    total_gross_sales: string;
    total_commissions_payable: string;
  };
  agents: Array<{
    agent_id: string;
    agent_name: string;
    agent_phone: string;
    bookings_count: number;
    seats_sold: number;
    gross_sales: string;
    commission_earned: string;
  }>;
}

export function OverviewClient() {
  const { getValidAccessToken, isAuthenticated } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const dateQs = new URLSearchParams();
  if (startDate) dateQs.set("start_date", startDate);
  if (endDate) dateQs.set("end_date", endDate);
  const qsString = dateQs.toString() ? `?${dateQs.toString()}` : "";

  const kpiQuery = useQuery({
    queryKey: ["overview-kpis", startDate, endDate],
    queryFn: async () => {
      const [revenue, occupancy, routePerf, agentSales] = await Promise.all([
        adminFetch<RevenueReport>(`${API_ENDPOINTS.ADMIN_REPORTS.REVENUE}${qsString}`, getValidAccessToken),
        adminFetch<OccupancyReport>(`${API_ENDPOINTS.ADMIN_REPORTS.OCCUPANCY}${qsString}`, getValidAccessToken),
        adminFetch<RoutePerformanceReport>(
          `${API_ENDPOINTS.ADMIN_REPORTS.ROUTE_PERFORMANCE}${qsString}`,
          getValidAccessToken
        ),
        adminFetch<AgentSalesReport>(
          `${API_ENDPOINTS.ADMIN_REPORTS.AGENT_SALES}${qsString}`,
          getValidAccessToken
        ),
      ]);
      return { revenue, occupancy, routePerf, agentSales };
    },
    enabled: isAuthenticated,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header + Date Filter */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Operations Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live revenue reconciliation, fleet load factor, corridor performance, and counter agent activity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            aria-label="Start date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-40"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            aria-label="End date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40"
          />
          {(startDate || endDate) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {kpiQuery.isError && (
        <Alert variant="danger">
          {(kpiQuery.error as Error)?.message || "Unable to load live KPI reports."}
        </Alert>
      )}

      {/* 4 KPI Tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiQuery.isLoading || !kpiQuery.data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>Net Retained Revenue</CardDescription>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="font-mono text-2xl font-semibold tabular-nums">
                  {formatCurrencyPkr(kpiQuery.data.revenue.summary.net_revenue)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {kpiQuery.data.revenue.summary.bookings_count} realized bookings
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>Collected vs. Refunds</CardDescription>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="font-mono text-2xl font-semibold tabular-nums">
                  {formatCurrencyPkr(kpiQuery.data.revenue.summary.total_collected)}
                </p>
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 tabular-nums">
                  -{formatCurrencyPkr(kpiQuery.data.revenue.summary.refunds_issued)} refunded
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>Fleet Load Factor</CardDescription>
                <Activity className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="font-mono text-2xl font-semibold tabular-nums">
                  {Number(kpiQuery.data.occupancy.summary.overall_load_factor_percentage).toFixed(1)}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {kpiQuery.data.occupancy.summary.trips_evaluated} scheduled trips evaluated
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>Counter Agent Commissions</CardDescription>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="font-mono text-2xl font-semibold tabular-nums">
                  {formatCurrencyPkr(kpiQuery.data.agentSales.summary.total_commissions_payable)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {kpiQuery.data.agentSales.summary.total_agents} active agents ({kpiQuery.data.agentSales.commission_rate_percentage}%)
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Quick Ops Launchers */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { href: "/fleet", title: "Fleet & Seat Studio", desc: "Buses, layouts, drivers", icon: Bus },
          { href: "/routes", title: "Terminals & Routes", desc: "Corridors & stop order", icon: MapPin },
          { href: "/trips", title: "Trip Scheduler", desc: "Trips, fares, seat blocks", icon: CalendarClock },
          { href: "/counter-pos", title: "Counter Walk-In POS", desc: "Instant agent ticketing", icon: Receipt },
          { href: "/gate-scanner", title: "Conductor Gate", desc: "QR validate & board", icon: QrCode },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-start justify-between rounded-lg border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div>
                <Icon className="h-4 w-4 text-primary" />
                <p className="mt-2.5 text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          );
        })}
      </div>

      {/* Corridor Performance & Agent Leaderboard */}
      {kpiQuery.data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Performing Corridors</CardTitle>
              <CardDescription>Ranked by realized segment fare revenue</CardDescription>
            </CardHeader>
            <CardContent>
              {kpiQuery.data.routePerf.top_routes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No corridor sales recorded in range.</p>
              ) : (
                <div className="divide-y text-sm">
                  {kpiQuery.data.routePerf.top_routes.slice(0, 6).map((route) => (
                    <div key={route.route_id} className="flex items-center justify-between py-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="neutral" className="font-mono text-[11px]">
                            {route.route_code}
                          </Badge>
                          <span className="font-medium">{route.route_name}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                          {route.seats_sold} seats sold
                        </p>
                      </div>
                      <span className="font-mono font-semibold tabular-nums">
                        {formatCurrencyPkr(route.fare_revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Counter Agent Sales</CardTitle>
              <CardDescription>Walk-in counter volume & 5% commission accrual</CardDescription>
            </CardHeader>
            <CardContent>
              {kpiQuery.data.agentSales.agents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No counter agent sales recorded yet.</p>
              ) : (
                <div className="divide-y text-sm">
                  {kpiQuery.data.agentSales.agents.slice(0, 6).map((agent) => (
                    <div key={agent.agent_id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="font-medium">{agent.agent_name}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {agent.agent_phone} · {agent.seats_sold} seats
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="font-mono font-semibold tabular-nums">
                          {formatCurrencyPkr(agent.gross_sales)}
                        </p>
                        <p className="font-mono text-xs text-emerald-700 dark:text-emerald-400 tabular-nums">
                          Comm: {formatCurrencyPkr(agent.commission_earned)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
