"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  Tag,
  Ticket,
  UserCheck,
  Users,
} from "lucide-react";
import { Gender, MAX_SEATS_PER_BOOKING } from "@busms/config/constants";
import { checkoutFormSchema, type CheckoutFormValues } from "@busms/config/schemas";
import {
  ApiException,
  API_ENDPOINTS,
  extractApiErrorMessage,
  getDefaultApiBaseUrl,
} from "@busms/api-client";
import { useAuth } from "@busms/api-client/auth";
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
  Label,
  LockCountdown,
  SeatMap,
  Skeleton,
  StatusBadge,
  formatCurrencyPkr,
  isSeatFemaleOnly,
  type SeatMapItem,
} from "@busms/ui";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { useApiClient } from "@/lib/api";

interface SeatMapResponseData {
  trip: {
    id: string;
    trip_number: string;
    departure_datetime: string;
    arrival_datetime: string;
    bus_registration: string;
    bus_type: string;
    bus_type_display: string;
  };
  segment: {
    from_stop: { id: string; city: string; terminal_name: string; stop_order: number };
    to_stop: { id: string; city: string; terminal_name: string; stop_order: number };
    distance_km: string;
    duration_minutes: number;
  };
  summary: {
    total: number;
    available: number;
    booked: number;
    locked: number;
    blocked: number;
    ladies_only: number;
  };
  seats: SeatMapItem[];
}

interface LockedSeatSummary {
  seat_id: string;
  seat_number: string;
  deck: number;
  row: number;
  column: number;
  seat_type: string;
  is_ladies_only: boolean;
  fare: string;
}

interface LockState {
  lock_token: string;
  locked_until: string;
  expires_in_seconds: number;
  locked_seats: LockedSeatSummary[];
}

interface CouponPreview {
  code: string;
  discount_type: string;
  discount_value: string;
  discount_amount: string;
  projected_tax_amount: string;
  projected_service_fee: string;
  projected_net_payable: string;
}

export interface CreatedBookingSummary {
  id: string;
  pnr: string;
  status: string;
  passenger_name: string;
  passenger_phone: string;
  passenger_email: string;
  trip_number: string;
  route_name: string;
  origin_city: string;
  origin_terminal: string;
  destination_city: string;
  destination_terminal: string;
  total_gross_fare: string;
  discount_amount: string;
  tax_amount: string;
  service_fee: string;
  net_amount: string;
  expires_at: string | null;
  seats: Array<{
    id: string;
    seat_id: string;
    seat_number: string;
    passenger_name: string;
    gender: string;
    price: string;
  }>;
}

interface SavedCompanion {
  id: string;
  full_name: string;
  gender: Gender;
  age: number;
  cnic_id_number?: string | null;
}

async function fetchJsonWithClient<T>(
  url: string,
  init: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (init.token) {
    headers.set("Authorization", `Bearer ${init.token}`);
  }
  const res = await fetch(url, { ...init, headers });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const err = json?.error ?? {};
    throw new ApiException(
      extractApiErrorMessage(json, `Request failed (${res.status}).`),
      res.status,
      err.code || "API_ERROR",
      err.details || {}
    );
  }
  return json.data as T;
}

export function SeatBookingFlow({
  tripId,
  fromStopId,
  toStopId,
}: {
  tripId: string;
  fromStopId: string;
  toStopId: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { isAuthenticated, user, profile, getValidAccessToken } = useAuth();
  const api = useApiClient();

  const currentUrlWithParams = useMemo(() => {
    const qs = searchParams.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);
  const loginRedirectHref = `/login?next=${encodeURIComponent(currentUrlWithParams)}`;

  const baseUrl = getDefaultApiBaseUrl().replace(/\/$/, "");
  const storageKey = `busms_lock_${tripId}_${fromStopId}_${toStopId}`;

  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [activeGender, setActiveGender] = useState<Gender>(Gender.MALE);
  const [seatGenders, setSeatGenders] = useState<Record<string, Gender>>({});
  const [lockState, setLockState] = useState<LockState | null>(null);
  const [createdBooking, setCreatedBooking] = useState<CreatedBookingSummary | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [isLocking, setIsLocking] = useState(false);

  // Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  // Saved companions (for logged-in passengers)
  const [savedCompanions, setSavedCompanions] = useState<SavedCompanion[]>([]);

  // Restore unexpired lock if page reloaded during checkout
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as LockState;
      if (parsed?.lock_token && parsed?.locked_until) {
        if (new Date(parsed.locked_until).getTime() > Date.now() + 5000) {
          setLockState(parsed);
          setSelectedSeatIds(parsed.locked_seats.map((s) => s.seat_id));
        } else {
          window.sessionStorage.removeItem(storageKey);
        }
      }
    } catch {
      // ignore invalid storage
    }
  }, [storageKey]);

  // Fetch saved companions when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    void api
      .GET("/api/accounts/saved-passengers/")
      .then((res) => {
        if (!active) return;
        const body = res.data as unknown as { data?: SavedCompanion[] | { results?: SavedCompanion[] } };
        const raw = body?.data;
        const list = Array.isArray(raw) ? raw : raw?.results ?? [];
        setSavedCompanions(list);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [api, isAuthenticated]);

  const seatMapQuery = useQuery({
    queryKey: ["seat-map", tripId, fromStopId, toStopId],
    queryFn: () =>
      fetchJsonWithClient<SeatMapResponseData>(
        `${baseUrl}${API_ENDPOINTS.SEARCH.seatMap(tripId)}?from_stop=${encodeURIComponent(
          fromStopId
        )}&to_stop=${encodeURIComponent(toStopId)}`
      ),
    enabled: Boolean(tripId && fromStopId && toStopId),
    refetchInterval: lockState || createdBooking ? false : 15_000,
  });

  const seatMapData = seatMapQuery.data;

  const selectedSeatsDetailed = useMemo(() => {
    if (!seatMapData) return [];
    const lookup = new Map(seatMapData.seats.map((s) => [s.id, s]));
    return selectedSeatIds.map((id) => lookup.get(id)).filter((s): s is SeatMapItem => Boolean(s));
  }, [seatMapData, selectedSeatIds]);

  const activeSeatsForPricing = lockState?.locked_seats ?? selectedSeatsDetailed;
  const grossFareSubtotal = useMemo(
    () =>
      activeSeatsForPricing.reduce((acc, s) => {
        const val = Number(s.fare ?? 0);
        return acc + (Number.isFinite(val) ? val : 0);
      }, 0),
    [activeSeatsForPricing]
  );

  // Checkout form
  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      passenger_name: profile?.full_name || "",
      passenger_phone: user?.phone || "",
      passenger_email: user?.email || "",
      coupon_code: "",
      passengers: [],
    },
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "passengers",
  });

  const seatMapLookup = useMemo(() => {
    const map = new Map<string, SeatMapItem>();
    if (seatMapData) {
      for (const s of seatMapData.seats) map.set(s.id, s);
    }
    return map;
  }, [seatMapData]);

  // Sync passenger form rows whenever lockState changes
  useEffect(() => {
    if (!lockState) return;
    if (profile?.full_name && !form.getValues("passenger_name")) {
      form.setValue("passenger_name", profile.full_name);
    }
    if (user?.phone && !form.getValues("passenger_phone")) {
      form.setValue("passenger_phone", user.phone);
    }
    if (user?.email && !form.getValues("passenger_email")) {
      form.setValue("passenger_email", user.email);
    }

    replace(
      lockState.locked_seats.map((seat, idx) => {
        const mapSeat = seatMapLookup.get(seat.seat_id);
        const femaleRestricted = seat.is_ladies_only || (mapSeat ? isSeatFemaleOnly(mapSeat) : false);
        const chosenGender = femaleRestricted
          ? Gender.FEMALE
          : seatGenders[seat.seat_id] ??
            (idx === 0 && profile?.gender ? profile.gender : activeGender);
        return {
          seat_id: seat.seat_id,
          seat_number: seat.seat_number,
          is_ladies_only: femaleRestricted,
          passenger_name: idx === 0 && profile?.full_name ? profile.full_name : "",
          gender: chosenGender,
          age: "",
          cnic_or_id: idx === 0 && profile?.cnic_id_number ? profile.cnic_id_number : "",
        };
      })
    );
  }, [lockState, profile, user, replace, form, seatMapLookup, seatGenders, activeGender]);

  const handleSeatSelectionChange = useCallback(
    (nextIds: string[]) => {
      setSelectedSeatIds(nextIds);
      setSeatGenders((prev) => {
        const next: Record<string, Gender> = {};
        for (const id of nextIds) {
          const seat = seatMapLookup.get(id);
          if (seat && isSeatFemaleOnly(seat)) {
            next[id] = Gender.FEMALE;
          } else {
            next[id] = prev[id] ?? activeGender;
          }
        }
        return next;
      });
    },
    [seatMapLookup, activeGender]
  );

  const handleAcquireLock = async () => {
    if (selectedSeatIds.length === 0) return;
    setStepError(null);
    setRequiresAuth(false);

    const token = await getValidAccessToken();
    if (!isAuthenticated || !token) {
      router.push(loginRedirectHref);
      return;
    }

    setIsLocking(true);
    try {
      const seat_genders = Object.fromEntries(
        selectedSeatIds.map((id) => {
          const seat = seatMapLookup.get(id);
          const g = seat && isSeatFemaleOnly(seat) ? Gender.FEMALE : (seatGenders[id] ?? activeGender);
          return [id, g];
        })
      );
      const locked = await fetchJsonWithClient<LockState>(`${baseUrl}${API_ENDPOINTS.BOOKINGS.LOCK_SEATS}`, {
        method: "POST",
        token,
        body: JSON.stringify({
          trip_id: tripId,
          seat_ids: selectedSeatIds,
          seat_genders,
          from_stop: fromStopId,
          to_stop: toStopId,
          lock_duration_minutes: 10,
        }),
      });
      setLockState(locked);
      setCouponPreview(null);
      setCouponInput("");
      window.sessionStorage.setItem(storageKey, JSON.stringify(locked));
    } catch (err) {
      if (err instanceof ApiException && err.status === 401) {
        setRequiresAuth(true);
        setStepError("Please sign in to your passenger account to lock seats and book.");
      } else {
        setStepError(err instanceof ApiException ? err.message : "Could not lock selected seats.");
      }
      await queryClient.invalidateQueries({ queryKey: ["seat-map", tripId, fromStopId, toStopId] });
    } finally {
      setIsLocking(false);
    }
  };

  const handleReleaseLock = useCallback(async () => {
    if (!lockState) return;
    const tokenToRelease = lockState.lock_token;
    setLockState(null);
    setCouponPreview(null);
    setStepError(null);
    setRequiresAuth(false);
    window.sessionStorage.removeItem(storageKey);

    const token = await getValidAccessToken();
    await fetch(`${baseUrl}${API_ENDPOINTS.BOOKINGS.UNLOCK_SEATS}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ lock_token: tokenToRelease }),
    }).catch(() => undefined);

    await queryClient.invalidateQueries({ queryKey: ["seat-map", tripId, fromStopId, toStopId] });
  }, [lockState, storageKey, baseUrl, queryClient, tripId, fromStopId, toStopId, getValidAccessToken]);

  const handleHoldExpired = useCallback(() => {
    setLockState(null);
    setCouponPreview(null);
    window.sessionStorage.removeItem(storageKey);
    setStepError(t("seatBooking.holdExpired"));
    void queryClient.invalidateQueries({ queryKey: ["seat-map", tripId, fromStopId, toStopId] });
  }, [storageKey, t, queryClient, tripId, fromStopId, toStopId]);

  const handleValidateCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponError(null);
    setIsValidatingCoupon(true);
    try {
      const token = await getValidAccessToken();
      const preview = await fetchJsonWithClient<CouponPreview>(
        `${baseUrl}${API_ENDPOINTS.PROMOTIONS.VALIDATE_COUPON}`,
        {
          method: "POST",
          token,
          body: JSON.stringify({
            code,
            gross_amount: grossFareSubtotal.toFixed(2),
            passenger_phone: form.getValues("passenger_phone") || "",
          }),
        }
      );
      setCouponPreview(preview);
      form.setValue("coupon_code", preview.code);
    } catch (err) {
      setCouponPreview(null);
      form.setValue("coupon_code", "");
      setCouponError(err instanceof ApiException ? err.message : "Invalid coupon code.");
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const onCreateBooking = async (values: CheckoutFormValues) => {
    if (!lockState) return;
    setStepError(null);
    try {
      const token = await getValidAccessToken();
      const created = await fetchJsonWithClient<CreatedBookingSummary>(
        `${baseUrl}${API_ENDPOINTS.BOOKINGS.CREATE}`,
        {
          method: "POST",
          token,
          body: JSON.stringify({
            trip_id: tripId,
            lock_token: lockState.lock_token,
            from_stop: fromStopId,
            to_stop: toStopId,
            passenger_name: values.passenger_name,
            passenger_phone: values.passenger_phone,
            passenger_email: values.passenger_email || "",
            payment_method: "STRIPE",
            coupon_code: couponPreview?.code || values.coupon_code || "",
            passengers: values.passengers.map((p) => ({
              seat_id: p.seat_id,
              passenger_name: p.passenger_name,
              gender: p.gender,
              age: p.age ? Number(p.age) : null,
              cnic_or_id: p.cnic_or_id || "",
            })),
          }),
        }
      );

      window.sessionStorage.removeItem(storageKey);
      setCreatedBooking(created);
      setLockState(null);
    } catch (err) {
      if (err instanceof ApiException && err.status === 401) {
        setRequiresAuth(true);
        setStepError("Your session expired. Please sign in again to complete this booking.");
      } else {
        setStepError(
          err instanceof ApiException ? err.message : "Unable to create booking reservation."
        );
      }
    }
  };

  const currentStep = createdBooking ? 3 : lockState ? 2 : 1;

  if (!fromStopId || !toStopId) {
    return (
      <Alert variant="warning">
        Missing segment stop parameters (`from_stop` and `to_stop`). Please search trips again to select a valid segment.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card px-5 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/search"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            <span>{t("common.back")}</span>
          </Link>
          <span className="text-border">|</span>
          {seatMapData ? (
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {seatMapData.segment.from_stop.city} → {seatMapData.segment.to_stop.city}
                </span>
                <Badge variant="default" className="font-mono text-[11px]">
                  {seatMapData.trip.trip_number}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {seatMapData.segment.from_stop.terminal_name} →{" "}
                {seatMapData.segment.to_stop.terminal_name} ·{" "}
                {seatMapData.trip.bus_type_display}
              </p>
            </div>
          ) : (
            <Skeleton className="h-8 w-56" />
          )}
        </div>

        {/* 3-Step Indicator */}
        <ol className="flex items-center gap-2 text-xs font-medium">
          {[
            { num: 1, label: t("seatBooking.stepSelect") },
            { num: 2, label: t("seatBooking.stepCheckout") },
            { num: 3, label: t("seatBooking.stepPay") },
          ].map((step) => (
            <li
              key={step.num}
              className={`rounded-md px-2.5 py-1 ${
                currentStep === step.num
                  ? "bg-primary text-primary-foreground"
                  : currentStep > step.num
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {step.label}
            </li>
          ))}
        </ol>
      </div>

      {stepError && (
        <Alert variant="danger" className="flex flex-wrap items-center justify-between gap-2">
          <span>{stepError}</span>
          {requiresAuth && (
            <Link href={loginRedirectHref}>
              <Button size="sm" variant="outline">
                {t("common.signIn")}
              </Button>
            </Link>
          )}
        </Alert>
      )}

      {/* STEP 1: SEAT SELECTION */}
      {currentStep === 1 && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("seatBooking.stepSelect")}</CardTitle>
              <CardDescription>
                {seatMapData
                  ? `${seatMapData.summary.available} available of ${seatMapData.summary.total} seats · Max ${MAX_SEATS_PER_BOOKING} per booking`
                  : "Loading live cabin layout..."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {seatMapQuery.isLoading ? (
                <div className="space-y-3 py-8">
                  <Skeleton className="mx-auto h-80 max-w-md" />
                </div>
              ) : seatMapQuery.isError ? (
                <Alert variant="danger">
                  {(seatMapQuery.error as Error)?.message || "Failed to load seat map."}
                </Alert>
              ) : seatMapData ? (
                <div className="space-y-4">
                  {/* Gender Selector for Dynamic Seating */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold">Selecting seats for</p>
                      <p className="text-[11px] text-muted-foreground">
                        Seats adjacent to a female passenger are reserved for female travelers.
                      </p>
                    </div>
                    <div className="inline-flex rounded-md border bg-card p-1">
                      {(
                        [
                          { value: Gender.MALE, label: "Male" },
                          { value: Gender.FEMALE, label: "Female" },
                          { value: Gender.OTHER, label: "Other" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setActiveGender(opt.value)}
                          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                            activeGender === opt.value
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <SeatMap
                    seats={seatMapData.seats}
                    selectedSeatIds={selectedSeatIds}
                    onSelectionChange={handleSeatSelectionChange}
                    activeGender={activeGender}
                    maxSeats={MAX_SEATS_PER_BOOKING}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="h-fit sticky top-20">
            <CardHeader>
              <CardTitle className="text-base">{t("seatBooking.selectedSeats")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedSeatsDetailed.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("seatBooking.noSeatsSelected")}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {selectedSeatsDetailed.map((seat) => {
                    const femaleOnly = isSeatFemaleOnly(seat);
                    const assignedGender = femaleOnly
                      ? Gender.FEMALE
                      : (seatGenders[seat.id] ?? activeGender);
                    return (
                      <div
                        key={seat.id}
                        className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold">{seat.seat_number}</span>
                          <span className="text-xs text-muted-foreground">
                            {seat.seat_type.replace(/_/g, " ")}
                          </span>
                          {femaleOnly && (
                            <Badge variant="ladies" className="text-[10px]">
                              Ladies
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            aria-label={`Gender for seat ${seat.seat_number}`}
                            value={assignedGender}
                            disabled={femaleOnly}
                            onChange={(e) =>
                              setSeatGenders((prev) => ({
                                ...prev,
                                [seat.id]: e.target.value as Gender,
                              }))
                            }
                            className="h-7 rounded border border-input bg-card px-1.5 text-[11px] font-medium disabled:opacity-70"
                          >
                            {!femaleOnly && <option value={Gender.MALE}>Male</option>}
                            <option value={Gender.FEMALE}>Female</option>
                            {!femaleOnly && <option value={Gender.OTHER}>Other</option>}
                          </select>
                          <span className="font-mono font-semibold tabular-nums">
                            {formatCurrencyPkr(seat.fare)}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex items-center justify-between border-t pt-3 text-sm font-semibold">
                    <span>{t("seatBooking.fareSubtotal")}</span>
                    <span className="font-mono text-base tabular-nums">
                      {formatCurrencyPkr(grossFareSubtotal)}
                    </span>
                  </div>
                </div>
              )}

              {!isAuthenticated && (
                <p className="text-xs text-muted-foreground">
                  Sign in is required to hold seats and confirm your booking.
                </p>
              )}

              <Button
                type="button"
                className="w-full"
                disabled={selectedSeatIds.length === 0 || isLocking}
                onClick={handleAcquireLock}
              >
                {isLocking
                  ? t("seatBooking.locking")
                  : !isAuthenticated
                    ? "Sign in to Lock Seats"
                    : t("seatBooking.lockSeatsCta")}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 2: PASSENGER DETAILS & PROMO CHECKOUT */}
      {currentStep === 2 && lockState && (
        <form onSubmit={form.handleSubmit(onCreateBooking)} className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {/* Hold Timer Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("seatBooking.holdExpiresIn")}
                </span>
                <LockCountdown
                  lockedUntil={lockState.locked_until}
                  onExpire={handleHoldExpired}
                />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleReleaseLock}>
                {t("seatBooking.releaseHold")}
              </Button>
            </div>

            {/* Primary Contact */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("seatBooking.contactDetails")}</CardTitle>
                <CardDescription>
                  Booking PNR and QR boarding pass will be associated with this contact.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="contact-name">Full Name</Label>
                  <Input id="contact-name" {...form.register("passenger_name")} />
                  {form.formState.errors.passenger_name && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.passenger_name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-phone">Phone Number</Label>
                  <Input
                    id="contact-phone"
                    placeholder="+923001234567"
                    {...form.register("passenger_phone")}
                  />
                  {form.formState.errors.passenger_phone && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.passenger_phone.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-email">Email (optional)</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    placeholder="name@example.com"
                    {...form.register("passenger_email")}
                  />
                  {form.formState.errors.passenger_email && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.passenger_email.message}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Per-seat passenger assignment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-primary" />
                  <span>{t("seatBooking.passengerDetails")}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {fields.map((field, index) => {
                  const seatErrors = form.formState.errors.passengers?.[index];
                  const isLadies = Boolean(field.is_ladies_only);
                  return (
                    <div key={field.id} className="rounded-lg border bg-background p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="font-mono">
                            Seat {field.seat_number}
                          </Badge>
                          {isLadies && (
                            <Badge variant="ladies" className="gap-1">
                              <UserCheck className="h-3 w-3" />
                              {t("seatBooking.ladiesOnlyNotice")}
                            </Badge>
                          )}
                        </div>

                        {savedCompanions.length > 0 && (
                          <select
                            aria-label="Autofill saved passenger"
                            defaultValue=""
                            onChange={(e) => {
                              const comp = savedCompanions.find((c) => c.id === e.target.value);
                              if (!comp) return;
                              form.setValue(`passengers.${index}.passenger_name`, comp.full_name);
                              if (!isLadies || comp.gender === Gender.FEMALE) {
                                form.setValue(`passengers.${index}.gender`, comp.gender);
                              }
                              form.setValue(`passengers.${index}.age`, comp.age ? String(comp.age) : "");
                              form.setValue(
                                `passengers.${index}.cnic_or_id`,
                                comp.cnic_id_number || ""
                              );
                            }}
                            className="h-8 rounded border border-input bg-card px-2 text-xs"
                          >
                            <option value="">Autofill saved passenger...</option>
                            {savedCompanions.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.full_name} ({c.gender})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="space-y-1 sm:col-span-2">
                          <Label>Passenger Name</Label>
                          <Input {...form.register(`passengers.${index}.passenger_name`)} />
                          {seatErrors?.passenger_name && (
                            <p className="text-xs text-destructive">
                              {seatErrors.passenger_name.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label>Gender</Label>
                          <select
                            {...form.register(`passengers.${index}.gender`)}
                            className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {!isLadies && <option value={Gender.MALE}>Male</option>}
                            <option value={Gender.FEMALE}>Female</option>
                            {!isLadies && <option value={Gender.OTHER}>Other</option>}
                          </select>
                          {seatErrors?.gender && (
                            <p className="text-xs text-destructive">{seatErrors.gender.message}</p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label>Age</Label>
                          <Input
                            type="number"
                            min={1}
                            max={120}
                            placeholder="28"
                            {...form.register(`passengers.${index}.age`)}
                          />
                          {seatErrors?.age && (
                            <p className="text-xs text-destructive">{seatErrors.age.message}</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label>CNIC / Government ID</Label>
                        <Input
                          placeholder="35202-1234567-1"
                          {...form.register(`passengers.${index}.cnic_or_id`)}
                        />
                        {seatErrors?.cnic_or_id && (
                          <p className="text-xs text-destructive">
                            {seatErrors.cnic_or_id.message}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Fare & Promo Summary */}
          <Card className="h-fit sticky top-20">
            <CardHeader>
              <CardTitle className="text-base">Checkout Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Promo input */}
              <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                <Label htmlFor="promo-code" className="flex items-center gap-1.5 text-xs">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  <span>{t("seatBooking.promoCode")}</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="promo-code"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="SAVE10"
                    className="font-mono uppercase"
                    disabled={Boolean(couponPreview)}
                  />
                  {couponPreview ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCouponPreview(null);
                        setCouponInput("");
                        form.setValue("coupon_code", "");
                      }}
                    >
                      {t("seatBooking.removeCoupon")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!couponInput.trim() || isValidatingCoupon}
                      onClick={handleValidateCoupon}
                    >
                      {t("seatBooking.applyCoupon")}
                    </Button>
                  )}
                </div>
                {couponError && <p className="text-xs text-destructive">{couponError}</p>}
                {couponPreview && (
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    Coupon {couponPreview.code} applied (-{formatCurrencyPkr(couponPreview.discount_amount)})
                  </p>
                )}
              </div>

              {/* Price lines (authoritative from server) */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("seatBooking.fareSubtotal")}</span>
                  <span className="font-mono tabular-nums">{formatCurrencyPkr(grossFareSubtotal)}</span>
                </div>

                {couponPreview && (
                  <>
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                      <span>{t("seatBooking.couponDiscount")}</span>
                      <span className="font-mono tabular-nums">
                        -{formatCurrencyPkr(couponPreview.discount_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("seatBooking.taxLabel")}</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrencyPkr(couponPreview.projected_tax_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("seatBooking.serviceFeeLabel")}</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrencyPkr(couponPreview.projected_service_fee)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2.5 text-base font-semibold">
                      <span>{t("seatBooking.netPayable")}</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrencyPkr(couponPreview.projected_net_payable)}
                      </span>
                    </div>
                  </>
                )}

                {!couponPreview && (
                  <p className="border-t pt-2.5 text-xs text-muted-foreground">
                    Authoritative 5% tax & PKR 50 platform service fee are computed by the server upon confirming reservation.
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting
                  ? t("seatBooking.creatingBooking")
                  : t("seatBooking.createBookingCta")}
              </Button>
            </CardContent>
          </Card>
        </form>
      )}

      {/* STEP 3: PENDING PNR CREATED — PAYMENT HANDOFF */}
      {currentStep === 3 && createdBooking && (
        <Card className="mx-auto max-w-2xl shadow-elevated">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="h-5 w-5" />
                <CardTitle>{t("seatBooking.pnrCreatedTitle")}</CardTitle>
              </div>
              <StatusBadge status={createdBooking.status} />
            </div>
            <CardDescription>
              PNR{" "}
              <span className="font-mono font-semibold text-foreground">{createdBooking.pnr}</span>{" "}
              · {createdBooking.origin_city} → {createdBooking.destination_city}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {createdBooking.expires_at && (
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-2.5 text-xs">
                <span>Complete payment before reservation expires:</span>
                <LockCountdown lockedUntil={createdBooking.expires_at} />
              </div>
            )}

            <div className="space-y-2 rounded-lg border p-4 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Ticket className="h-4 w-4 text-primary" />
                <span>Reserved Seats ({createdBooking.seats.length})</span>
              </div>
              {createdBooking.seats.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Seat <strong className="font-mono text-foreground">{s.seat_number}</strong> ·{" "}
                    {s.passenger_name} ({s.gender})
                  </span>
                  <span className="font-mono tabular-nums">{formatCurrencyPkr(s.price)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("seatBooking.fareSubtotal")}</span>
                <span className="font-mono tabular-nums">
                  {formatCurrencyPkr(createdBooking.total_gross_fare)}
                </span>
              </div>
              {Number(createdBooking.discount_amount) > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>{t("seatBooking.couponDiscount")}</span>
                  <span className="font-mono tabular-nums">
                    -{formatCurrencyPkr(createdBooking.discount_amount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("seatBooking.taxLabel")}</span>
                <span className="font-mono tabular-nums">
                  {formatCurrencyPkr(createdBooking.tax_amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("seatBooking.serviceFeeLabel")}</span>
                <span className="font-mono tabular-nums">
                  {formatCurrencyPkr(createdBooking.service_fee)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2.5 text-base font-semibold">
                <span>{t("seatBooking.netPayable")}</span>
                <span className="font-mono tabular-nums">
                  {formatCurrencyPkr(createdBooking.net_amount)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Amounts verified by Django pricing engine</span>
              </div>

              <Link href={`/checkout/${encodeURIComponent(createdBooking.pnr)}`}>
                <Button className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  <span>{t("seatBooking.proceedStripe")}</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
