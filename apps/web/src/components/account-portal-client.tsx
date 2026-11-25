"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  LogOut,
  Pencil,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  Ticket,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { Gender } from "@busms/config/constants";
import { savedPassengerSchema, type SavedPassengerFormValues } from "@busms/config/schemas";
import {
  ApiException,
  getDefaultApiBaseUrl,
  normalizePaginated,
  type PaginatedData,
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
  PaginationBar,
  Skeleton,
  StatusBadge,
  formatCurrencyPkr,
} from "@busms/ui";
import { Link, useRouter } from "@/i18n/routing";
import { CancellationDrawer, type BookingRecord } from "./cancellation-drawer";
import { TicketQrModal } from "./ticket-qr-modal";

interface SavedCompanion {
  id: string;
  full_name: string;
  gender: Gender;
  age: number;
  cnic_id_number: string | null;
}

export function AccountPortalClient() {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading, user, profile, logout, getValidAccessToken, setProfile } =
    useAuth();
  const baseUrl = getDefaultApiBaseUrl().replace(/\/$/, "");

  const [activeTab, setActiveTab] = useState<"bookings" | "companions" | "profile">("bookings");
  const [bookingFilter, setBookingFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // PNR quick lookup
  const [pnrQuery, setPnrQuery] = useState("");
  const [lookupResult, setLookupResult] = useState<BookingRecord | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Drawers / Modals
  const [cancelBookingTarget, setCancelBookingTarget] = useState<BookingRecord | null>(null);
  const [ticketModalPnr, setTicketModalPnr] = useState<string | null>(null);

  // Saved companion editing
  const [editingCompanion, setEditingCompanion] = useState<SavedCompanion | null>(null);
  const [companionError, setCompanionError] = useState<string | null>(null);

  // Profile form state
  const [profileFullName, setProfileFullName] = useState(profile?.full_name || "");
  const [profileGender, setProfileGender] = useState<Gender>(profile?.gender || Gender.MALE);
  const [profileCnic, setProfileCnic] = useState(profile?.cnic_id_number || "");
  const [profileEmergency, setProfileEmergency] = useState(profile?.emergency_contact || "");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (profile) {
      setProfileFullName(profile.full_name || "");
      setProfileGender(profile.gender || Gender.MALE);
      setProfileCnic(profile.cnic_id_number || "");
      setProfileEmergency(profile.emergency_contact || "");
    }
  }, [profile]);

  const bookingsQuery = useQuery({
    queryKey: ["my-bookings", bookingFilter, page, pageSize],
    queryFn: async () => {
      const token = await getValidAccessToken();
      const qs = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (bookingFilter) qs.set("filter", bookingFilter);

      const res = await fetch(`${baseUrl}/api/bookings/?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new ApiException(json?.error?.message || "Could not load bookings.", res.status);
      }
      return normalizePaginated<BookingRecord>(
        json.data as PaginatedData<BookingRecord> | BookingRecord[],
        pageSize
      );
    },
    enabled: isAuthenticated,
  });

  const companionsQuery = useQuery({
    queryKey: ["saved-passengers"],
    queryFn: async () => {
      const token = await getValidAccessToken();
      const res = await fetch(`${baseUrl}/api/accounts/saved-passengers/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new ApiException(json?.error?.message || "Failed to load saved passengers.", res.status);
      }
      const raw = json.data;
      return (Array.isArray(raw) ? raw : raw?.results ?? []) as SavedCompanion[];
    },
    enabled: isAuthenticated,
  });

  const companionForm = useForm({
    resolver: zodResolver(savedPassengerSchema),
    defaultValues: {
      full_name: "",
      gender: Gender.MALE,
      age: 28,
      cnic_id_number: "",
    },
  });

  const handlePnrLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = pnrQuery.trim().toUpperCase();
    if (!cleaned) return;
    setLookupError(null);
    setLookupResult(null);
    setIsLookingUp(true);
    try {
      const res = await fetch(`${baseUrl}/api/bookings/${encodeURIComponent(cleaned)}/`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setLookupError(json?.error?.message || `No booking found for PNR '${cleaned}'.`);
        return;
      }
      setLookupResult(json.data as BookingRecord);
    } catch {
      setLookupError("Unable to look up PNR right now.");
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSaveCompanion = async (values: SavedPassengerFormValues) => {
    setCompanionError(null);
    try {
      const token = await getValidAccessToken();
      const url = editingCompanion
        ? `${baseUrl}/api/accounts/saved-passengers/${editingCompanion.id}/`
        : `${baseUrl}/api/accounts/saved-passengers/`;
      const method = editingCompanion ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(values),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setCompanionError(json?.error?.message || "Could not save companion.");
        return;
      }
      setEditingCompanion(null);
      companionForm.reset({ full_name: "", gender: Gender.MALE, age: 28, cnic_id_number: "" });
      await queryClient.invalidateQueries({ queryKey: ["saved-passengers"] });
    } catch {
      setCompanionError("Network error saving companion.");
    }
  };

  const handleDeleteCompanion = async (id: string) => {
    const token = await getValidAccessToken();
    await fetch(`${baseUrl}/api/accounts/saved-passengers/${id}/`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    await queryClient.invalidateQueries({ queryKey: ["saved-passengers"] });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    const token = await getValidAccessToken();
    const res = await fetch(`${baseUrl}/api/accounts/profile/`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        full_name: profileFullName,
        gender: profileGender,
        cnic_id_number: profileCnic || null,
        emergency_contact: profileEmergency || null,
      }),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success) {
      setProfile(json.data);
      setProfileMsg("Profile updated.");
    }
  };

  const refreshBookingsAfterCancel = async () => {
    await queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    if (lookupResult) {
      const res = await fetch(`${baseUrl}/api/bookings/${encodeURIComponent(lookupResult.pnr)}/`);
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        setLookupResult(json.data as BookingRecord);
        setCancelBookingTarget(json.data as BookingRecord);
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Header + Quick PNR Lookup */}
      <div className="grid gap-6 rounded-xl border bg-card p-6 lg:grid-cols-[1fr_380px] lg:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("account.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("account.subtitle")}</p>
        </div>

        <form onSubmit={handlePnrLookup} className="space-y-2">
          <Label htmlFor="pnr-lookup" className="text-xs text-muted-foreground">
            {t("account.pnrLookupTitle")}
          </Label>
          <div className="flex gap-2">
            <Input
              id="pnr-lookup"
              value={pnrQuery}
              onChange={(e) => setPnrQuery(e.target.value.toUpperCase())}
              placeholder={t("account.pnrLookupPlaceholder")}
              className="font-mono uppercase"
            />
            <Button type="submit" disabled={isLookingUp}>
              <Search className="h-4 w-4" />
              <span>{t("account.lookupCta")}</span>
            </Button>
          </div>
          {lookupError && <p className="text-xs text-destructive">{lookupError}</p>}
        </form>
      </div>

      {/* PNR Lookup Result Card */}
      {lookupResult && (
        <BookingSummaryCard
          booking={lookupResult}
          onViewTickets={() => setTicketModalPnr(lookupResult.pnr)}
          onCancel={() => setCancelBookingTarget(lookupResult)}
          t={t}
        />
      )}

      {/* Authenticated Account Portal */}
      {authLoading ? (
        <Skeleton className="h-64" />
      ) : !isAuthenticated ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sign in for Full Booking History & Saved Travelers</CardTitle>
            <CardDescription>
              Guest passengers can still look up any booking above by PNR to download QR passes or cancel seats.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Link href="/login">
              <Button>{t("common.signIn")}</Button>
            </Link>
            <Link href="/register">
              <Button variant="outline">{t("common.register")}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Account Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div className="flex gap-1">
              {[
                { key: "bookings", label: t("account.tabBookings"), icon: Ticket },
                { key: "companions", label: t("account.tabCompanions"), icon: Users },
                { key: "profile", label: t("account.tabProfile"), icon: User },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key as typeof activeTab)}
                    className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await logout();
                router.replace("/login");
              }}
            >
              <LogOut className="h-4 w-4" />
              <span>{t("common.signOut")}</span>
            </Button>
          </div>

          {/* TAB: MY BOOKINGS */}
          {activeTab === "bookings" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "", label: t("account.filterAll") },
                  { key: "upcoming", label: t("account.filterUpcoming") },
                  { key: "pending", label: t("account.filterPending") },
                  { key: "past", label: t("account.filterPast") },
                  { key: "cancelled", label: t("account.filterCancelled") },
                ].map((f) => (
                  <button
                    key={f.key || "all"}
                    type="button"
                    onClick={() => {
                      setBookingFilter(f.key);
                      setPage(1);
                    }}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      bookingFilter === f.key
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {bookingsQuery.isLoading ? (
                <Skeleton className="h-48" />
              ) : bookingsQuery.isError ? (
                <Alert variant="danger">
                  {(bookingsQuery.error as Error)?.message || "Could not fetch bookings."}
                </Alert>
              ) : (bookingsQuery.data?.results.length ?? 0) === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    {t("account.noBookings")}
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="space-y-3">
                    {bookingsQuery.data!.results.map((b) => (
                      <BookingSummaryCard
                        key={b.id}
                        booking={b}
                        onViewTickets={() => setTicketModalPnr(b.pnr)}
                        onCancel={() => setCancelBookingTarget(b)}
                        t={t}
                      />
                    ))}
                  </div>
                  <PaginationBar
                    currentPage={bookingsQuery.data!.current_page}
                    totalPages={bookingsQuery.data!.total_pages}
                    totalCount={bookingsQuery.data!.count}
                    pageSize={bookingsQuery.data!.page_size}
                    onPageChange={setPage}
                    onPageSizeChange={(next) => {
                      setPageSize(next);
                      setPage(1);
                    }}
                  />
                </>
              )}
            </div>
          )}

          {/* TAB: SAVED PASSENGERS */}
          {activeTab === "companions" && (
            <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Plus className="h-4 w-4 text-primary" />
                    <span>{editingCompanion ? "Edit Companion" : t("account.addCompanion")}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={companionForm.handleSubmit(handleSaveCompanion)} className="space-y-3">
                    {companionError && <Alert variant="danger">{companionError}</Alert>}
                    <div className="space-y-1">
                      <Label>Full Name</Label>
                      <Input {...companionForm.register("full_name")} />
                      {companionForm.formState.errors.full_name && (
                        <p className="text-xs text-destructive">
                          {companionForm.formState.errors.full_name.message}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-3 grid-cols-2">
                      <div className="space-y-1">
                        <Label>Gender</Label>
                        <select
                          {...companionForm.register("gender")}
                          className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                        >
                          <option value={Gender.MALE}>Male</option>
                          <option value={Gender.FEMALE}>Female</option>
                          <option value={Gender.OTHER}>Other</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label>Age</Label>
                        <Input type="number" min={1} max={120} {...companionForm.register("age")} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>CNIC / Passport</Label>
                      <Input placeholder="35202-1234567-1" {...companionForm.register("cnic_id_number")} />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button type="submit" className="flex-1">
                        {t("common.save")}
                      </Button>
                      {editingCompanion && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingCompanion(null);
                            companionForm.reset();
                          }}
                        >
                          {t("common.cancel")}
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {companionsQuery.isLoading ? (
                  <Skeleton className="h-40" />
                ) : (companionsQuery.data?.length ?? 0) === 0 ? (
                  <Card>
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                      {t("account.noCompanions")}
                    </CardContent>
                  </Card>
                ) : (
                  companionsQuery.data!.map((comp) => (
                    <Card key={comp.id}>
                      <CardContent className="flex items-center justify-between gap-4 p-4">
                        <div>
                          <p className="font-semibold">{comp.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {comp.gender} · Age {comp.age}
                            {comp.cnic_id_number ? ` · ${comp.cnic_id_number}` : ""}
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label="Edit companion"
                            onClick={() => {
                              setEditingCompanion(comp);
                              companionForm.reset({
                                full_name: comp.full_name,
                                gender: comp.gender,
                                age: comp.age,
                                cnic_id_number: comp.cnic_id_number || "",
                              });
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label="Delete companion"
                            onClick={() => handleDeleteCompanion(comp.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: PROFILE */}
          {activeTab === "profile" && (
            <Card className="max-w-xl">
              <CardHeader>
                <CardTitle className="text-base">Account Profile</CardTitle>
                <CardDescription>
                  Phone: <span className="font-mono">{user?.phone}</span>
                  {user?.email ? ` · ${user.email}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  {profileMsg && <Alert variant="success">{profileMsg}</Alert>}
                  <div className="space-y-1.5">
                    <Label>Full Name</Label>
                    <Input value={profileFullName} onChange={(e) => setProfileFullName(e.target.value)} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Gender</Label>
                      <select
                        value={profileGender}
                        onChange={(e) => setProfileGender(e.target.value as Gender)}
                        className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                      >
                        <option value={Gender.MALE}>Male</option>
                        <option value={Gender.FEMALE}>Female</option>
                        <option value={Gender.OTHER}>Other</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>CNIC / Passport</Label>
                      <Input value={profileCnic} onChange={(e) => setProfileCnic(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Emergency Contact</Label>
                    <Input
                      value={profileEmergency}
                      onChange={(e) => setProfileEmergency(e.target.value)}
                    />
                  </div>
                  <Button type="submit">{t("common.save")}</Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <CancellationDrawer
        booking={cancelBookingTarget}
        onClose={() => setCancelBookingTarget(null)}
        onCancelled={refreshBookingsAfterCancel}
      />

      <TicketQrModal pnr={ticketModalPnr} onClose={() => setTicketModalPnr(null)} />
    </div>
  );
}

function BookingSummaryCard({
  booking,
  onViewTickets,
  onCancel,
  t,
}: {
  booking: BookingRecord;
  onViewTickets: () => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral" className="font-mono text-xs">
              PNR {booking.pnr}
            </Badge>
            <StatusBadge status={booking.status} />
            <span className="font-mono text-xs text-muted-foreground">{booking.trip_number}</span>
          </div>
          <p className="text-base font-semibold">
            {booking.origin_city} → {booking.destination_city}
          </p>
          <p className="text-xs text-muted-foreground">
            {booking.origin_terminal} → {booking.destination_terminal} · Seats:{" "}
            <strong className="font-mono text-foreground">
              {booking.seats.map((s) => s.seat_number).join(", ")}
            </strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-end me-2">
            <p className="font-mono text-base font-semibold tabular-nums">
              {formatCurrencyPkr(booking.net_amount)}
            </p>
            <p className="text-[11px] text-muted-foreground">{booking.passenger_name}</p>
          </div>

          {booking.status === "PENDING" && (
            <Link href={`/checkout/${encodeURIComponent(booking.pnr)}`}>
              <Button size="sm">{t("account.payNow")}</Button>
            </Link>
          )}

          {["CONFIRMED", "PARTIALLY_CANCELLED", "COMPLETED"].includes(booking.status) && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onViewTickets}>
              <QrCode className="h-4 w-4" />
              <span>{t("account.viewTickets")}</span>
            </Button>
          )}

          <Button variant="outline" size="sm" className="gap-1.5" onClick={onCancel}>
            <RotateCcw className="h-4 w-4" />
            <span>{t("account.manageCancel")}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
