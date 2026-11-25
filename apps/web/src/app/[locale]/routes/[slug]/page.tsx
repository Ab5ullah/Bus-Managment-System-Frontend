import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowRight, Clock, MapPin, Milestone } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, formatCurrencyPkr } from "@busms/ui";
import { Link } from "@/i18n/routing";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  fetchRouteDetail,
  fetchRoutes,
  fetchTripSearch,
  formatDuration,
  parseRouteSlug,
} from "@/lib/public-api";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseRouteSlug(slug);
  if (!parsed) {
    return { title: "Route Guide | SafarLine" };
  }
  return {
    title: `${parsed.origin} to ${parsed.destination} Bus Tickets — Timings & Fares | SafarLine`,
    description: `Check departure timings, intermediate stops, terminal details, and live PKR fares from ${parsed.origin} to ${parsed.destination}.`,
  };
}

export default async function RouteDetailSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations();
  const parsed = parseRouteSlug(slug);
  if (!parsed) {
    notFound();
  }

  const [routesPage, tripSearch] = await Promise.all([
    fetchRoutes({ page: 1, pageSize: 50, search: parsed.origin }),
    fetchTripSearch({ origin: parsed.origin, destination: parsed.destination }),
  ]);

  const matchedSummary = routesPage.results.find(
    (r) =>
      r.origin_city.toLowerCase() === parsed.origin.toLowerCase() &&
      r.destination_city.toLowerCase() === parsed.destination.toLowerCase()
  );

  const routeDetail = matchedSummary ? await fetchRouteDetail(matchedSummary.id) : null;
  const upcomingTrips = tripSearch.result?.trips ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-10 sm:px-6">
        <div className="rounded-xl border bg-card p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              {routeDetail && (
                <Badge variant="default" className="mb-2 font-mono text-xs">
                  {routeDetail.code}
                </Badge>
              )}
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {parsed.origin} to {parsed.destination} Bus Tickets — Timings & Fares
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {routeDetail?.description ||
                  `Scheduled express and executive coach departures connecting ${parsed.origin} and ${parsed.destination}.`}
              </p>
            </div>

            <Link
              href={`/search?origin=${encodeURIComponent(parsed.origin)}&destination=${encodeURIComponent(parsed.destination)}`}
            >
              <Button className="gap-1.5">
                <span>Search All Departures</span>
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </Link>
          </div>

          {routeDetail && (
            <div className="mt-6 grid gap-4 border-t pt-5 sm:grid-cols-3">
              <div className="flex items-center gap-2.5 text-sm">
                <Milestone className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("routesPage.distance")}</p>
                  <p className="font-mono font-semibold tabular-nums">
                    {Math.round(Number(routeDetail.total_distance_km))} km
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Clock className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("routesPage.duration")}</p>
                  <p className="font-mono font-semibold tabular-nums">
                    {formatDuration(routeDetail.estimated_duration_minutes)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <MapPin className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Terminals</p>
                  <p className="font-semibold">
                    {routeDetail.stops.length} sequenced stops
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Upcoming Departures */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">
              {t("routesPage.upcomingDepartures", {
                origin: parsed.origin,
                destination: parsed.destination,
              })}
            </h2>

            {upcomingTrips.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">
                  No upcoming scheduled departures are currently open for this corridor. Check back soon or search nearby dates.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {upcomingTrips.slice(0, 8).map((trip) => (
                  <Card key={trip.trip_id}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="default">{trip.bus.bus_type_display}</Badge>
                          <span className="font-mono text-xs text-muted-foreground">
                            {trip.trip_number}
                          </span>
                        </div>
                        <p className="mt-1.5 font-mono text-sm font-semibold tabular-nums">
                          {new Date(trip.origin.departure_time).toLocaleString("en-PK", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {trip.origin.terminal_name} → {trip.destination.terminal_name}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-end">
                          <p className="font-mono text-base font-semibold tabular-nums">
                            {formatCurrencyPkr(trip.fare.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("common.seatsLeft", { count: trip.availability.available_seats })}
                          </p>
                        </div>
                        <Link
                          href={`/trips/${trip.trip_id}/seats?from_stop=${encodeURIComponent(
                            trip.segment_details.from_stop_id
                          )}&to_stop=${encodeURIComponent(trip.segment_details.to_stop_id)}`}
                        >
                          <Button size="sm">{t("search.selectSeats")}</Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Stop Sequence */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">{t("routesPage.stopsTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              {routeDetail && routeDetail.stops.length > 0 ? (
                <ol className="relative space-y-5 border-s border-border ps-5">
                  {routeDetail.stops.map((stop) => (
                    <li key={stop.id} className="relative">
                      <span className="absolute -start-[25px] top-1 flex h-2.5 w-2.5 rounded-full border-2 border-primary bg-card" />
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{stop.terminal_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {stop.terminal_city} · <span className="font-mono">{stop.terminal_code}</span>
                          </p>
                        </div>
                        <div className="text-end font-mono text-xs text-muted-foreground tabular-nums">
                          <p>{Math.round(Number(stop.distance_from_origin_km))} km</p>
                          <p>+{formatDuration(stop.offset_minutes)}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Origin: {parsed.origin} · Destination: {parsed.destination}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
