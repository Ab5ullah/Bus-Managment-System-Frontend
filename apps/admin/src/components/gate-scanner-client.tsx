"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  QrCode,
  CheckCircle2,
  XCircle,
  ScanLine,
  Users,
  Clock,
  Bus,
  MapPin,
  RefreshCcw,
  List,
  Camera,
  Keyboard,
} from "lucide-react";
import {
  Button,
  Card,
  Input,
  Label,
  Skeleton,
  Alert,
  Badge,
  StatusBadge,
  PaginationBar,
  formatCurrencyPkr,
} from "@busms/ui";
import { useAuth } from "@busms/api-client/auth";
import { normalizePaginated, type PaginatedData } from "@busms/api-client";
import { API_ENDPOINTS } from "@busms/config/endpoints";
import { adminFetch, formatShortDateTime } from "@/lib/admin-api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ValidateQrResponse {
  ticket_number: string;
  passenger_name: string;
  seat_number: string;
  trip: {
    id: string;
    route_code: string;
    departure_datetime: string;
    bus_registration: string;
  };
  from_terminal: string;
  to_terminal: string;
  status: string;
  is_eligible_to_board: boolean;
  ineligibility_reason?: string;
}

interface BoardResponse {
  ticket_number: string;
  passenger_name: string;
  seat_number: string;
  boarded_at: string;
  boarded_by: string;
}

interface ManifestEntry {
  ticket_number: string;
  passenger_name: string;
  seat_number: string;
  phone: string;
  status: string;
  from_terminal: string;
  to_terminal: string;
  boarded_at: string | null;
}

type ScanMode = "manual" | "camera";
type ViewMode = "scanner" | "manifest";

export function GateScannerClient() {
  const t = useTranslations();
  const { getValidAccessToken: getToken } = useAuth();

  const [viewMode, setViewMode] = useState<ViewMode>("scanner");
  const [scanMode, setScanMode] = useState<ScanMode>("manual");
  const [token, setToken] = useState("");
  const [validated, setValidated] = useState<ValidateQrResponse | null>(null);
  const [boarded, setBoarded] = useState<BoardResponse | null>(null);
  const [scanError, setScanError] = useState("");

  // Manifest state
  const [tripId, setTripId] = useState("");
  const [manifestPage, setManifestPage] = useState(1);

  const tokenInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Validate QR ─────────────────────────────────────────────────────────

  const validateMutation = useMutation({
    mutationFn: (qrToken: string) =>
      adminFetch<ValidateQrResponse>(API_ENDPOINTS.TICKETS.VALIDATE_QR, getToken, {
        method: "POST",
        body: JSON.stringify({ qr_token: qrToken }),
      }),
    onSuccess: (data) => {
      setValidated(data);
      setBoarded(null);
      setScanError("");
    },
    onError: (err: Error) => {
      setScanError(err.message);
      setValidated(null);
      setBoarded(null);
    },
  });

  // ─── Board passenger ─────────────────────────────────────────────────────

  const boardMutation = useMutation({
    mutationFn: (qrToken: string) =>
      adminFetch<BoardResponse>(API_ENDPOINTS.TICKETS.BOARD, getToken, {
        method: "POST",
        body: JSON.stringify({ qr_token: qrToken }),
      }),
    onSuccess: (data) => {
      setBoarded(data);
      setScanError("");
    },
    onError: (err: Error) => setScanError(err.message),
  });

  const handleManualScan = () => {
    if (!token.trim()) return;
    setValidated(null);
    setBoarded(null);
    setScanError("");
    validateMutation.mutate(token.trim());
  };

  const handleBoard = () => {
    if (!token.trim() || !validated) return;
    boardMutation.mutate(token.trim());
  };

  const reset = useCallback(() => {
    setToken("");
    setValidated(null);
    setBoarded(null);
    setScanError("");
    setTimeout(() => tokenInputRef.current?.focus(), 50);
  }, []);

  // ─── Camera scan via BarcodeDetector ─────────────────────────────────────

  useEffect(() => {
    if (scanMode !== "camera") return;

    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Use BarcodeDetector if available
        if ("BarcodeDetector" in window) {
          // @ts-expect-error – BarcodeDetector is a newer browser API
          const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          scanIntervalRef.current = setInterval(async () => {
            if (!videoRef.current) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const rawValue = barcodes[0].rawValue as string;
                setToken(rawValue);
                validateMutation.mutate(rawValue);
                setScanMode("manual"); // Switch back after scan
              }
            } catch {
              // ignore detection errors
            }
          }, 500);
        }
      } catch {
        setScanError(t("scanner.cameraError"));
        setScanMode("manual");
      }
    };

    startCamera();

    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanMode]);

  // ─── Manifest ─────────────────────────────────────────────────────────────

  const manifestQuery = useQuery({
    queryKey: ["manifest", tripId, manifestPage],
    queryFn: async () => {
      const raw = await adminFetch<PaginatedData<ManifestEntry> | ManifestEntry[]>(
        `${API_ENDPOINTS.TICKETS.manifest(tripId)}?page=${manifestPage}&page_size=20`,
        getToken
      );
      return normalizePaginated(raw, 20);
    },
    enabled: !!tripId && viewMode === "manifest",
  });

  const boardedCount =
    (manifestQuery.data?.results ?? []).filter((e) => e.status === "BOARDED").length;

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("scanner.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("scanner.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === "scanner" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("scanner")}
          >
            <ScanLine className="me-2 h-4 w-4" />
            {t("scanner.gateMode")}
          </Button>
          <Button
            variant={viewMode === "manifest" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("manifest")}
          >
            <List className="me-2 h-4 w-4" />
            {t("scanner.manifestMode")}
          </Button>
        </div>
      </div>

      {scanError && (
        <Alert variant="danger">
          <span>{scanError}</span>
        </Alert>
      )}

      {/* ── SCANNER VIEW ──────────────────────────────────────────────── */}
      {viewMode === "scanner" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input panel */}
          <div className="space-y-4">
            <Card className="p-5">
              <div className="mb-4 flex gap-2">
                <Button
                  variant={scanMode === "manual" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setScanMode("manual")}
                >
                  <Keyboard className="me-1.5 h-3.5 w-3.5" />
                  {t("scanner.manualEntry")}
                </Button>
                <Button
                  variant={scanMode === "camera" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setScanMode("camera")}
                >
                  <Camera className="me-1.5 h-3.5 w-3.5" />
                  {t("scanner.cameraMode")}
                </Button>
              </div>

              {scanMode === "manual" ? (
                <div className="space-y-3">
                  <Label>{t("scanner.qrTokenLabel")}</Label>
                  <Input
                    ref={tokenInputRef}
                    placeholder={t("scanner.tokenPlaceholder")}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleManualScan();
                    }}
                    className="font-mono"
                    autoFocus
                  />
                  <Button
                    className="w-full"
                    onClick={handleManualScan}
                    disabled={!token.trim() || validateMutation.isPending}
                  >
                    <QrCode className="me-2 h-4 w-4" />
                    {validateMutation.isPending
                      ? t("scanner.validating")
                      : t("scanner.validateQr")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative overflow-hidden rounded-lg bg-black aspect-square">
                    <video
                      ref={videoRef}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="h-40 w-40 rounded-lg border-2 border-primary shadow-lg" />
                    </div>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    {t("scanner.alignQrCode")}
                  </p>
                </div>
              )}
            </Card>

            {/* Quick stats */}
            <Card className="p-4">
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div>
                  <QrCode className="mx-auto mb-1 h-5 w-5 text-primary" />
                  <p className="font-semibold">{t("scanner.scanQr")}</p>
                </div>
                <div>
                  <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-green-600" />
                  <p className="font-semibold">{t("scanner.verify")}</p>
                </div>
                <div>
                  <Users className="mx-auto mb-1 h-5 w-5 text-blue-600" />
                  <p className="font-semibold">{t("scanner.board")}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Result panel */}
          <div className="space-y-4">
            {validateMutation.isPending && (
              <Skeleton className="h-64 w-full" />
            )}

            {/* Valid ticket */}
            {validated && !boarded && (
              <Card
                className={`p-5 ${validated.is_eligible_to_board
                  ? "border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-900/20"
                  : "border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20"
                  }`}
              >
                <div className="mb-4 flex items-center gap-3">
                  {validated.is_eligible_to_board ? (
                    <CheckCircle2 className="h-7 w-7 text-green-600" />
                  ) : (
                    <XCircle className="h-7 w-7 text-red-600" />
                  )}
                  <div>
                    <p className="font-bold">
                      {validated.is_eligible_to_board
                        ? t("scanner.eligibleToBoard")
                        : t("scanner.notEligible")}
                    </p>
                    {validated.ineligibility_reason && (
                      <p className="text-sm text-red-700 dark:text-red-300">
                        {validated.ineligibility_reason}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("scanner.passenger")}</span>
                    <span className="font-medium">{validated.passenger_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("scanner.seat")}</span>
                    <span className="font-medium">{validated.seat_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("scanner.ticket")}</span>
                    <span className="font-mono text-xs">{validated.ticket_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("scanner.from")}</span>
                    <span className="font-medium">{validated.from_terminal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("scanner.to")}</span>
                    <span className="font-medium">{validated.to_terminal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("scanner.departure")}</span>
                    <span className="font-medium">
                      {formatShortDateTime(validated.trip.departure_datetime)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("common.status")}</span>
                    <StatusBadge status={validated.status} />
                  </div>
                </div>

                {validated.is_eligible_to_board && (
                  <Button
                    className="mt-4 w-full"
                    onClick={handleBoard}
                    disabled={boardMutation.isPending}
                  >
                    {boardMutation.isPending
                      ? t("scanner.boarding")
                      : t("scanner.boardPassenger")}
                  </Button>
                )}

                <Button variant="outline" size="sm" className="mt-2 w-full" onClick={reset}>
                  <RefreshCcw className="me-2 h-3.5 w-3.5" />
                  {t("scanner.scanNext")}
                </Button>
              </Card>
            )}

            {/* Successfully boarded */}
            {boarded && (
              <Card className="border-green-300 bg-green-50/50 p-6 text-center dark:border-green-800 dark:bg-green-900/20">
                <CheckCircle2 className="mx-auto mb-3 h-14 w-14 text-green-600" />
                <h2 className="text-xl font-bold text-green-900 dark:text-green-100">
                  {t("scanner.boardedSuccess")}
                </h2>
                <p className="mt-1 text-sm font-medium">{boarded.passenger_name}</p>
                <p className="text-xs text-muted-foreground">
                  {t("scanner.seat")}: {boarded.seat_number} ·{" "}
                  {formatShortDateTime(boarded.boarded_at)}
                </p>
                <Button className="mt-5 w-full" onClick={reset}>
                  <ScanLine className="me-2 h-4 w-4" />
                  {t("scanner.scanNext")}
                </Button>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── MANIFEST VIEW ─────────────────────────────────────────────── */}
      {viewMode === "manifest" && (
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-4 font-semibold">{t("scanner.tripManifest")}</h2>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <Label>{t("scanner.tripId")}</Label>
                <Input
                  placeholder={t("scanner.tripIdPlaceholder")}
                  value={tripId}
                  onChange={(e) => setTripId(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => {
                    setManifestPage(1);
                    manifestQuery.refetch();
                  }}
                  disabled={!tripId.trim()}
                >
                  {t("scanner.loadManifest")}
                </Button>
              </div>
            </div>
          </Card>

          {manifestQuery.isLoading && (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          )}

          {manifestQuery.data && (
            <>
              {/* Stats bar */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3 text-center">
                  <p className="text-2xl font-bold">{manifestQuery.data.count}</p>
                  <p className="text-xs text-muted-foreground">{t("scanner.totalPassengers")}</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{boardedCount}</p>
                  <p className="text-xs text-muted-foreground">{t("scanner.boarded")}</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">
                    {manifestQuery.data.count - boardedCount}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("scanner.pending")}</p>
                </Card>
              </div>

              {/* Manifest table */}
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                        <th className="px-4 py-3 text-start font-medium">{t("scanner.ticket")}</th>
                        <th className="px-4 py-3 text-start font-medium">{t("scanner.passenger")}</th>
                        <th className="px-4 py-3 text-start font-medium">{t("scanner.seat")}</th>
                        <th className="px-4 py-3 text-start font-medium">{t("scanner.from")}</th>
                        <th className="px-4 py-3 text-start font-medium">{t("scanner.to")}</th>
                        <th className="px-4 py-3 text-start font-medium">{t("common.status")}</th>
                        <th className="px-4 py-3 text-start font-medium">{t("scanner.boardedAt")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(manifestQuery.data.results ?? []).map((entry) => (
                        <tr
                          key={entry.ticket_number}
                          className={`transition-colors ${entry.status === "BOARDED"
                            ? "bg-green-50/40 dark:bg-green-900/10"
                            : "hover:bg-muted/30"
                            }`}
                        >
                          <td className="px-4 py-3 font-mono text-xs">{entry.ticket_number}</td>
                          <td className="px-4 py-3 font-medium">{entry.passenger_name}</td>
                          <td className="px-4 py-3">{entry.seat_number}</td>
                          <td className="px-4 py-3 text-xs">{entry.from_terminal}</td>
                          <td className="px-4 py-3 text-xs">{entry.to_terminal}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={entry.status} />
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {entry.boarded_at ? formatShortDateTime(entry.boarded_at) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <PaginationBar
                currentPage={manifestPage}
                totalPages={Math.ceil((manifestQuery.data.count ?? 0) / 20)}
                totalCount={manifestQuery.data.count ?? 0}
                pageSize={20}
                onPageChange={setManifestPage}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
