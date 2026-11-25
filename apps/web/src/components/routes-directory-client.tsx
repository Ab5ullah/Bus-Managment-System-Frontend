"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Clock, MapPin, Search } from "lucide-react";
import type { PaginatedData } from "@busms/api-client";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, PaginationBar } from "@busms/ui";
import { Link, useRouter } from "@/i18n/routing";
import { buildRouteSlug, formatDuration, type RouteListItem } from "@/lib/public-api";

export function RoutesDirectoryClient({
  initialData,
  initialSearch,
}: {
  initialData: PaginatedData<RouteListItem>;
  initialSearch: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);

  const navigateWith = (nextPage: number, nextPageSize: number, nextSearch: string) => {
    const qs = new URLSearchParams();
    qs.set("page", String(nextPage));
    qs.set("page_size", String(nextPageSize));
    if (nextSearch.trim()) qs.set("search", nextSearch.trim());
    router.push(`/routes?${qs.toString()}`);
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigateWith(1, initialData.page_size, search);
        }}
        className="flex flex-wrap gap-2"
      >
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search route code, city, or corridor name..."
            className="ps-9"
          />
        </div>
        <Button type="submit">{t("common.search")}</Button>
        {initialSearch && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSearch("");
              navigateWith(1, initialData.page_size, "");
            }}
          >
            {t("common.reset")}
          </Button>
        )}
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {initialData.results.map((route) => {
          const slug = buildRouteSlug(route.origin_city, route.destination_city);
          return (
            <Card key={route.id} className="flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="neutral" className="font-mono text-[11px]">
                    {route.code}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDuration(route.estimated_duration_minutes)}
                  </span>
                </div>
                <CardTitle className="mt-2 text-base">
                  {route.origin_city} → {route.destination_city}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{route.name}</p>
              </CardHeader>

              <CardContent className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {route.stops_count} stops
                  </span>
                  <span className="font-mono tabular-nums">
                    {Math.round(Number(route.total_distance_km))} km
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Link href={`/routes/${slug}`} className="text-xs font-medium text-primary hover:underline">
                    Route Details
                  </Link>
                  <Link
                    href={`/search?origin=${encodeURIComponent(route.origin_city)}&destination=${encodeURIComponent(route.destination_city)}`}
                  >
                    <Button size="sm" variant="secondary" className="gap-1">
                      <span>Schedules</span>
                      <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <PaginationBar
        currentPage={initialData.current_page}
        totalPages={initialData.total_pages}
        totalCount={initialData.count}
        pageSize={initialData.page_size}
        onPageChange={(nextPage) => navigateWith(nextPage, initialData.page_size, initialSearch)}
        onPageSizeChange={(nextSize) => navigateWith(1, nextSize, initialSearch)}
        pageSizeOptions={[9, 12, 24]}
      />
    </div>
  );
}
