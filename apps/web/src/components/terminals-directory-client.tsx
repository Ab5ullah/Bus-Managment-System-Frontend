"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin, Phone, Search } from "lucide-react";
import type { PaginatedData } from "@busms/api-client";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, PaginationBar } from "@busms/ui";
import { useRouter } from "@/i18n/routing";
import type { TerminalItem } from "@/lib/public-api";

export function TerminalsDirectoryClient({
  initialData,
  cities,
  initialCity,
  initialSearch,
}: {
  initialData: PaginatedData<TerminalItem>;
  cities: string[];
  initialCity: string;
  initialSearch: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [city, setCity] = useState(initialCity);
  const [search, setSearch] = useState(initialSearch);

  const navigateWith = (nextPage: number, nextPageSize: number, nextCity: string, nextSearch: string) => {
    const qs = new URLSearchParams();
    qs.set("page", String(nextPage));
    qs.set("page_size", String(nextPageSize));
    if (nextCity) qs.set("city", nextCity);
    if (nextSearch.trim()) qs.set("search", nextSearch.trim());
    router.push(`/terminals?${qs.toString()}`);
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigateWith(1, initialData.page_size, city, search);
        }}
        className="flex flex-wrap gap-2"
      >
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("terminalsPage.searchPlaceholder")}
            className="ps-9"
          />
        </div>

        <select
          aria-label={t("terminalsPage.cityFilter")}
          value={city}
          onChange={(e) => {
            const nextCity = e.target.value;
            setCity(nextCity);
            navigateWith(1, initialData.page_size, nextCity, search);
          }}
          className="h-10 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">{t("terminalsPage.allCities")}</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <Button type="submit">{t("common.search")}</Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {initialData.results.map((term) => (
          <Card key={term.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="neutral" className="font-mono text-[11px]">
                  {term.code}
                </Badge>
                {term.latitude && term.longitude && (
                  <Badge variant="success" className="text-[11px]">
                    {t("terminalsPage.gpsAvailable")}
                  </Badge>
                )}
              </div>
              <CardTitle className="mt-2 text-base">{term.name}</CardTitle>
              <p className="text-xs font-medium text-primary">{term.city}</p>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              {term.address && (
                <p className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{term.address}</span>
                </p>
              )}
              {term.contact_number && (
                <p className="flex items-center gap-1.5 font-mono">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{term.contact_number}</span>
                </p>
              )}
              {term.latitude && term.longitude && (
                <p className="font-mono text-[11px] tabular-nums">
                  {term.latitude}, {term.longitude}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <PaginationBar
        currentPage={initialData.current_page}
        totalPages={initialData.total_pages}
        totalCount={initialData.count}
        pageSize={initialData.page_size}
        onPageChange={(nextPage) => navigateWith(nextPage, initialData.page_size, city, search)}
        onPageSizeChange={(nextSize) => navigateWith(1, nextSize, city, search)}
        pageSizeOptions={[9, 12, 24]}
      />
    </div>
  );
}
