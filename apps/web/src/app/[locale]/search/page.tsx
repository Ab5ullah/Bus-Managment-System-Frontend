import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RouteSearchBar } from "@/components/route-search-bar";
import { SearchResultsClient } from "@/components/search-results-client";
import { fetchPopularRoutes, fetchTripSearch } from "@/lib/public-api";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const origin = typeof sp.origin === "string" ? sp.origin : "Lahore";
  const destination = typeof sp.destination === "string" ? sp.destination : "Islamabad";
  return {
    title: `${origin} to ${destination} Coach Search | SafarLine`,
    description: `Compare departure times, coach classes, and live PKR fares from ${origin} to ${destination}.`,
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const origin = typeof sp.origin === "string" && sp.origin ? sp.origin : "Lahore";
  const destination =
    typeof sp.destination === "string" && sp.destination ? sp.destination : "Islamabad";
  const date = typeof sp.date === "string" ? sp.date : "";
  const busType = typeof sp.bus_type === "string" ? sp.bus_type : "";
  const departureWindow =
    typeof sp.departure_window === "string" ? sp.departure_window : "";
  const maxPrice = typeof sp.max_price === "string" ? sp.max_price : "";
  const sortBy = typeof sp.sort_by === "string" ? sp.sort_by : "departure_asc";

  const [{ cities }, searchResponse] = await Promise.all([
    fetchPopularRoutes(),
    fetchTripSearch({
      origin,
      destination,
      date: date || undefined,
      bus_type: busType || undefined,
      departure_window: departureWindow || undefined,
      max_price: maxPrice || undefined,
      sort_by: sortBy,
    }),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6">
        <RouteSearchBar
          cities={cities}
          initialOrigin={origin}
          initialDestination={destination}
          initialDate={date}
          initialBusType={busType}
          compact
        />

        <SearchResultsClient
          origin={origin}
          destination={destination}
          date={date}
          busType={busType}
          departureWindow={departureWindow}
          maxPrice={maxPrice}
          sortBy={sortBy}
          trips={searchResponse.result?.trips ?? []}
          errorMessage={searchResponse.errorMessage}
        />
      </main>

      <SiteFooter />
    </div>
  );
}
