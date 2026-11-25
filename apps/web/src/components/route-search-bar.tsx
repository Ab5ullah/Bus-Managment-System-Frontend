"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeftRight, Calendar, MapPin, Search } from "lucide-react";
import { BusType } from "@busms/config/constants";
import { Button, Input, Label } from "@busms/ui";
import { useRouter } from "@/i18n/routing";

export interface RouteSearchBarProps {
  cities: string[];
  initialOrigin?: string;
  initialDestination?: string;
  initialDate?: string;
  initialBusType?: string;
  compact?: boolean;
}

export function RouteSearchBar({
  cities,
  initialOrigin = "Lahore",
  initialDestination = "Islamabad",
  initialDate = "",
  initialBusType = "",
  compact = false,
}: RouteSearchBarProps) {
  const t = useTranslations();
  const router = useRouter();

  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const [date, setDate] = useState(initialDate);
  const [busType, setBusType] = useState(initialBusType);
  const [error, setError] = useState<string | null>(null);

  const cityList = cities.length > 0 ? cities : ["Lahore", "Islamabad", "Faisalabad", "Peshawar", "Karachi"];

  const handleSwap = () => {
    setOrigin(destination);
    setDestination(origin);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin.trim() || !destination.trim()) {
      setError("Select both origin and destination cities.");
      return;
    }
    if (origin.trim().toLowerCase() === destination.trim().toLowerCase()) {
      setError("Origin and destination cannot be the same city.");
      return;
    }

    setError(null);
    const qs = new URLSearchParams();
    qs.set("origin", origin.trim());
    qs.set("destination", destination.trim());
    if (date) qs.set("date", date);
    if (busType) qs.set("bus_type", busType);
    router.push(`/search?${qs.toString()}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-xl border bg-card shadow-panel ${compact ? "p-4" : "p-5 sm:p-6"}`}
    >
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_1fr_1fr_auto] md:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="search-origin" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span>{t("hero.originLabel")}</span>
          </Label>
          <select
            id="search-origin"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t("hero.originPlaceholder")}</option>
            {cityList.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-center md:pb-0.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleSwap}
            title={t("hero.swapCities")}
            aria-label={t("hero.swapCities")}
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="search-destination" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span>{t("hero.destinationLabel")}</span>
          </Label>
          <select
            id="search-destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t("hero.destinationPlaceholder")}</option>
            {cityList.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="search-date" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span>{t("hero.dateLabel")}</span>
          </Label>
          <Input
            id="search-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label={t("hero.dateLabel")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="search-class" className="text-xs text-muted-foreground">
            {t("hero.busClassLabel")}
          </Label>
          <select
            id="search-class"
            value={busType}
            onChange={(e) => setBusType(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t("hero.allClasses")}</option>
            <option value={BusType.STANDARD_AC}>Standard AC</option>
            <option value={BusType.EXECUTIVE}>Executive</option>
            <option value={BusType.SLEEPER}>Sleeper</option>
            <option value={BusType.LUXURY}>Luxury</option>
          </select>
        </div>

        <Button type="submit" className="h-10 px-6">
          <Search className="h-4 w-4" />
          <span>{t("hero.searchCta")}</span>
        </Button>
      </div>

      {error && <p className="mt-2.5 text-xs font-medium text-destructive">{error}</p>}
    </form>
  );
}
