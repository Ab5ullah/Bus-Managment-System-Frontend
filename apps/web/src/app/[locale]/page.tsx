import { getTranslations } from "next-intl/server";
import { ArrowRight, Clock, Compass, QrCode, RotateCcw, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@busms/ui";
import { Link } from "@/i18n/routing";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RouteSearchBar } from "@/components/route-search-bar";
import { buildRouteSlug, fetchPopularRoutes, formatDuration } from "@/lib/public-api";

export const dynamic = "force-dynamic";

const FLEET_CLASSES = [
  {
    code: "STANDARD_AC",
    title: "Standard AC",
    layout: "2 × 2 · 40–45 Seats",
    description: "Climate-controlled motorway coaches with overhead luggage and reserved seating.",
  },
  {
    code: "EXECUTIVE",
    title: "Executive",
    layout: "2 × 1 · 30–36 Seats",
    description: "Extra legroom recliners, dedicated ladies-only rows, and onboard power outlets.",
  },
  {
    code: "SLEEPER",
    title: "Sleeper Coach",
    layout: "Upper & Lower Berths",
    description: "Overnight dual-deck berths engineered for long-haul interprovincial corridors.",
  },
  {
    code: "LUXURY",
    title: "Luxury",
    layout: "2 × 1 · Cabin Service",
    description: "Priority boarding, ergonomic lounge seating, and express non-stop schedules.",
  },
] as const;

export default async function HomePage() {
  const t = await getTranslations();
  const { cities, popular_routes } = await fetchPopularRoutes();

  // Deduplicate corridors by origin-destination pair for clean showcase
  const seenPairs = new Set<string>();
  const showcaseRoutes = popular_routes.filter((r) => {
    const key = `${r.origin_city.toLowerCase()}->${r.destination_city.toLowerCase()}`;
    if (seenPairs.has(key)) return false;
    seenPairs.add(key);
    return true;
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero & Search */}
        <section className="border-b bg-card">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="max-w-3xl space-y-4">
              <p className="inline-flex items-center gap-2 rounded-md border bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <Compass className="h-3.5 w-3.5 text-primary" />
                <span>{t("hero.eyebrow")}</span>
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {t("hero.title")}
              </h1>
              <p className="text-base leading-relaxed text-muted-foreground">
                {t("hero.subtitle")}
              </p>
            </div>

            <div className="mt-8">
              <RouteSearchBar
                cities={cities}
                initialOrigin={cities.includes("Lahore") ? "Lahore" : (cities[0] ?? "Lahore")}
                initialDestination={cities.includes("Islamabad") ? "Islamabad" : (cities[1] ?? "Islamabad")}
              />
            </div>
          </div>
        </section>

        {/* Popular Corridors */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{t("home.popularTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("home.popularSubtitle")}</p>
            </div>
            <Link href="/routes">
              <Button variant="outline" size="sm" className="gap-1.5">
                <span>{t("home.viewAllRoutes")}</span>
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </Button>
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {showcaseRoutes.slice(0, 6).map((route) => {
              const slug = buildRouteSlug(route.origin_city, route.destination_city);
              return (
                <Card key={route.route_id} className="flex flex-col justify-between transition-colors hover:border-primary/40">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="neutral" className="font-mono text-[11px]">
                        {route.code}
                      </Badge>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDuration(route.duration_minutes)}
                      </span>
                    </div>
                    <CardTitle className="mt-2 text-base">
                      {route.origin_city} → {route.destination_city}
                    </CardTitle>
                    <CardDescription className="line-clamp-1">{route.name}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between border-t pt-4">
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {Math.round(Number(route.distance_km))} km
                    </span>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/routes/${slug}`}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        Guide
                      </Link>
                      <Link
                        href={`/search?origin=${encodeURIComponent(route.origin_city)}&destination=${encodeURIComponent(route.destination_city)}`}
                      >
                        <Button size="sm" variant="secondary">
                          {t("home.viewSchedules")}
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Fleet Classes */}
        <section className="border-y bg-card">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{t("home.fleetTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("home.fleetSubtitle")}</p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FLEET_CLASSES.map((cls) => (
                <div key={cls.code} className="rounded-lg border bg-background p-5">
                  <Badge variant="default" className="font-mono text-[11px]">
                    {cls.layout}
                  </Badge>
                  <h3 className="mt-3 text-base font-semibold">{cls.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {cls.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust Highlights */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight">{t("home.trustTitle")}</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <div className="rounded-lg border bg-card p-5">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold">{t("home.trust1Title")}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {t("home.trust1Desc")}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-5">
              <QrCode className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold">{t("home.trust2Title")}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {t("home.trust2Desc")}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-5">
              <RotateCcw className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold">{t("home.trust3Title")}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {t("home.trust3Desc")}
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
