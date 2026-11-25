import { API_ENDPOINTS, getDefaultApiBaseUrl, normalizePaginated, type PaginatedData } from "@busms/api-client";

export interface PopularRouteItem {
  route_id: string;
  code: string;
  name: string;
  origin_city: string;
  destination_city: string;
  distance_km: string;
  duration_minutes: number;
}

export interface PopularRoutesPayload {
  cities: string[];
  popular_routes: PopularRouteItem[];
}

export interface TerminalItem {
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

export interface RouteStopItem {
  id: string;
  stop_order: number;
  terminal: string;
  terminal_name: string;
  terminal_code: string;
  terminal_city: string;
  distance_from_origin_km: string;
  offset_minutes: number;
}

export interface RouteListItem {
  id: string;
  code: string;
  name: string;
  origin: string;
  origin_city: string;
  origin_name: string;
  origin_code: string;
  destination: string;
  destination_city: string;
  destination_name: string;
  destination_code: string;
  total_distance_km: string;
  estimated_duration_minutes: number;
  stops_count: number;
  is_active: boolean;
}

export interface RouteDetailItem {
  id: string;
  code: string;
  name: string;
  origin: TerminalItem;
  destination: TerminalItem;
  total_distance_km: string;
  estimated_duration_minutes: number;
  description: string;
  is_active: boolean;
  stops: RouteStopItem[];
  segments_count: number;
}

export interface TripSearchItem {
  trip_id: string;
  trip_number: string;
  status: string;
  route: {
    id: string;
    code: string;
    name: string;
  };
  origin: {
    terminal_id: string;
    terminal_name: string;
    city: string;
    stop_order: number;
    departure_time: string;
  };
  destination: {
    terminal_id: string;
    terminal_name: string;
    city: string;
    stop_order: number;
    arrival_time: string;
  };
  segment_details: {
    from_stop_id: string;
    to_stop_id: string;
    distance_km: string;
    duration_minutes: number;
  };
  bus: {
    id: string;
    registration_number: string;
    bus_type: string;
    bus_type_display: string;
    amenities: unknown;
    total_seats: number;
  };
  driver: {
    name: string | null;
  };
  fare: {
    amount: string;
    currency: string;
  };
  availability: {
    available_seats: number;
    total_seats: number;
    is_sold_out: boolean;
  };
}

export interface TripSearchResultPayload {
  total_results: number;
  origin_query: string;
  destination_query: string;
  travel_date: string | null;
  trips: TripSearchItem[];
}

export function slugifyCity(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function buildRouteSlug(originCity: string, destinationCity: string): string {
  return `${slugifyCity(originCity)}-to-${slugifyCity(destinationCity)}`;
}

export function parseRouteSlug(slug: string): { origin: string; destination: string } | null {
  const parts = slug.split("-to-");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const toTitle = (s: string) =>
    s
      .split("-")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  return {
    origin: toTitle(parts[0]),
    destination: toTitle(parts[1]),
  };
}

export function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

async function fetchJsonSafe<T>(path: string, revalidateSeconds = 30): Promise<T | null> {
  const baseUrl = getDefaultApiBaseUrl().replace(/\/$/, "");
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      next: { revalidate: revalidateSeconds },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success?: boolean; data?: T };
    return json?.data ?? null;
  } catch {
    return null;
  }
}

export async function fetchPopularRoutes(): Promise<PopularRoutesPayload> {
  const data = await fetchJsonSafe<PopularRoutesPayload>(API_ENDPOINTS.SEARCH.POPULAR, 60);
  if (!data) {
    return { cities: [], popular_routes: [] };
  }
  const uniqueCities = Array.from(new Set(data.cities.map((c) => c.trim()).filter(Boolean))).sort();
  return {
    cities: uniqueCities,
    popular_routes: data.popular_routes ?? [],
  };
}

export async function fetchTerminals(params: {
  page?: number;
  pageSize?: number;
  city?: string;
  search?: string;
}): Promise<PaginatedData<TerminalItem>> {
  const qs = new URLSearchParams();
  qs.set("is_active", "true");
  qs.set("page", String(params.page ?? 1));
  qs.set("page_size", String(params.pageSize ?? 12));
  if (params.city) qs.set("city", params.city);
  if (params.search) qs.set("search", params.search);

  const data = await fetchJsonSafe<PaginatedData<TerminalItem> | TerminalItem[]>(
    `${API_ENDPOINTS.ROUTES.TERMINALS}?${qs.toString()}`,
    30
  );
  return normalizePaginated(data, params.pageSize ?? 12);
}

export async function fetchRoutes(params: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<PaginatedData<RouteListItem>> {
  const qs = new URLSearchParams();
  qs.set("is_active", "true");
  qs.set("page", String(params.page ?? 1));
  qs.set("page_size", String(params.pageSize ?? 12));
  if (params.search) qs.set("search", params.search);

  const data = await fetchJsonSafe<PaginatedData<RouteListItem> | RouteListItem[]>(
    `${API_ENDPOINTS.ROUTES.LIST}?${qs.toString()}`,
    30
  );
  return normalizePaginated(data, params.pageSize ?? 12);
}

export async function fetchRouteDetail(routeId: string): Promise<RouteDetailItem | null> {
  return fetchJsonSafe<RouteDetailItem>(API_ENDPOINTS.ROUTES.detail(routeId), 60);
}

export interface SearchTripsQuery {
  origin: string;
  destination: string;
  date?: string;
  bus_type?: string;
  departure_window?: string;
  min_price?: string;
  max_price?: string;
  sort_by?: string;
}

export async function fetchTripSearch(
  query: SearchTripsQuery
): Promise<{ result: TripSearchResultPayload | null; errorMessage: string | null }> {
  const qs = new URLSearchParams();
  qs.set("origin", query.origin);
  qs.set("destination", query.destination);
  if (query.date) qs.set("date", query.date);
  if (query.bus_type) qs.set("bus_type", query.bus_type);
  if (query.departure_window) qs.set("departure_window", query.departure_window);
  if (query.min_price) qs.set("min_price", query.min_price);
  if (query.max_price) qs.set("max_price", query.max_price);
  if (query.sort_by) qs.set("sort_by", query.sort_by);

  const baseUrl = getDefaultApiBaseUrl().replace(/\/$/, "");
  try {
    const res = await fetch(`${baseUrl}${API_ENDPOINTS.SEARCH.TRIPS}?${qs.toString()}`, {
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        result: null,
        errorMessage: json?.error?.message || "Unable to load matching departures.",
      };
    }
    return { result: json.data as TripSearchResultPayload, errorMessage: null };
  } catch {
    return { result: null, errorMessage: "Transit search service is temporarily unreachable." };
  }
}
