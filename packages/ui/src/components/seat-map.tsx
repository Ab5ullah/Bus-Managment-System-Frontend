"use client";

import React, { useMemo, useState } from "react";
import { UserCheck, Lock, Ban } from "lucide-react";
import { MAX_SEATS_PER_BOOKING } from "@busms/config/constants";
import { cn, formatCurrencyPkr } from "../lib/utils";
import { Alert } from "./alert";

export type SeatAvailabilityStatus = "AVAILABLE" | "BOOKED" | "LOCKED" | "BLOCKED";

export interface SeatMapItem {
  id: string;
  seat_number: string;
  row: number;
  column: number;
  deck: number;
  seat_type: string;
  is_ladies_only: boolean;
  status: SeatAvailabilityStatus | string;
  fare?: string | number;
  currency?: string;
  is_available?: boolean;
  occupied_gender?: "MALE" | "FEMALE" | "OTHER" | string | null;
  female_adjacent_restricted?: boolean;
  allowed_genders?: string[];
}

export interface SeatMapProps {
  seats: SeatMapItem[];
  selectedSeatIds: string[];
  onSelectionChange: (nextIds: string[]) => void;
  activeGender?: "MALE" | "FEMALE" | "OTHER" | string;
  maxSeats?: number;
  readOnly?: boolean;
  className?: string;
}

export function isSeatFemaleOnly(seat: SeatMapItem): boolean {
  if (seat.is_ladies_only || seat.female_adjacent_restricted) return true;
  if (
    Array.isArray(seat.allowed_genders) &&
    seat.allowed_genders.length > 0 &&
    !seat.allowed_genders.includes("MALE")
  ) {
    return true;
  }
  return false;
}

export function isSeatAllowedForGender(
  seat: SeatMapItem,
  gender?: string
): boolean {
  if (seat.status !== "AVAILABLE" || seat.is_available === false) return false;
  if (!gender) return true;
  if (Array.isArray(seat.allowed_genders) && seat.allowed_genders.length > 0) {
    return seat.allowed_genders.includes(gender);
  }
  if (isSeatFemaleOnly(seat) && gender !== "FEMALE") {
    return false;
  }
  return true;
}

export function SeatMap({
  seats,
  selectedSeatIds,
  onSelectionChange,
  activeGender,
  maxSeats = MAX_SEATS_PER_BOOKING,
  readOnly = false,
  className,
}: SeatMapProps) {
  const decks = useMemo(() => {
    const unique = Array.from(new Set(seats.map((s) => s.deck || 1))).sort((a, b) => a - b);
    return unique.length > 0 ? unique : [1];
  }, [seats]);

  const [activeDeck, setActiveDeck] = useState<number>(decks[0] ?? 1);
  const [limitWarning, setLimitWarning] = useState(false);

  const effectiveDeck = decks.includes(activeDeck) ? activeDeck : (decks[0] ?? 1);

  const deckSeats = useMemo(
    () => seats.filter((s) => (s.deck || 1) === effectiveDeck),
    [seats, effectiveDeck]
  );

  const { rows, cols, aisleAfterCol } = useMemo(() => {
    if (deckSeats.length === 0) {
      return { rows: [] as number[], cols: [] as number[], aisleAfterCol: 2 };
    }
    const maxRow = Math.max(...deckSeats.map((s) => s.row));
    const minRow = Math.min(...deckSeats.map((s) => s.row));
    const maxCol = Math.max(...deckSeats.map((s) => s.column));
    const minCol = Math.min(...deckSeats.map((s) => s.column));

    const rowList: number[] = [];
    for (let r = minRow; r <= maxRow; r += 1) rowList.push(r);

    const colList: number[] = [];
    for (let c = minCol; c <= maxCol; c += 1) colList.push(c);

    // Standard coach aisle: after column 2 for 4-col (2x2) or 3-col (2x1), or after col 1 for 2-col sleeper
    const colCount = colList.length;
    const aisleCol = colCount >= 3 ? minCol + 1 : colCount === 2 ? minCol : minCol;
    return { rows: rowList, cols: colList, aisleAfterCol: aisleCol };
  }, [deckSeats]);

  const seatLookup = useMemo(() => {
    const map = new Map<string, SeatMapItem>();
    for (const s of deckSeats) {
      map.set(`${s.row}-${s.column}`, s);
    }
    return map;
  }, [deckSeats]);

  const handleToggle = (seat: SeatMapItem) => {
    if (readOnly || seat.status !== "AVAILABLE" || seat.is_available === false) return;

    const isSelected = selectedSeatIds.includes(seat.id);
    if (isSelected) {
      setLimitWarning(false);
      onSelectionChange(selectedSeatIds.filter((id) => id !== seat.id));
      return;
    }

    if (!isSeatAllowedForGender(seat, activeGender)) return;

    if (selectedSeatIds.length >= maxSeats) {
      setLimitWarning(true);
      return;
    }

    setLimitWarning(false);
    onSelectionChange([...selectedSeatIds, seat.id]);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/40 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="h-4 w-4 rounded border border-emerald-500 bg-emerald-50" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-4 w-4 rounded border border-fuchsia-500 bg-fuchsia-50" />
          <span>Female-Only</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-4 w-4 rounded border border-indigo-700 bg-indigo-600" />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-4 w-4 rounded border border-slate-300 bg-slate-200 dark:border-slate-700 dark:bg-slate-800" />
          <span>Occupied / Locked</span>
        </div>
      </div>

      {/* Deck Tabs for Sleeper / Double-Deck */}
      {decks.length > 1 && (
        <div className="inline-flex rounded-lg border bg-muted p-1">
          {decks.map((deck) => (
            <button
              key={deck}
              type="button"
              onClick={() => setActiveDeck(deck)}
              className={cn(
                "rounded-md px-4 py-1.5 text-xs font-semibold transition-colors",
                effectiveDeck === deck
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {deck === 1 ? "Lower Deck" : deck === 2 ? "Upper Deck" : `Deck ${deck}`}
            </button>
          ))}
        </div>
      )}

      {limitWarning && (
        <Alert variant="warning">
          You can select up to {maxSeats} seats in a single reservation.
        </Alert>
      )}

      {/* Coach Floor Cabin */}
      <div className="mx-auto max-w-md rounded-2xl border-2 border-border bg-card p-4 sm:p-6 shadow-panel">
        {/* Driver / Front Header */}
        <div className="mb-5 flex items-center justify-between border-b border-dashed pb-3 text-xs text-muted-foreground">
          <span className="font-mono uppercase tracking-wider">Front Entrance</span>
          <span className="inline-flex items-center gap-1.5 rounded border bg-muted px-2.5 py-1 font-medium text-foreground">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="2" />
              <path d="M12 14v7M4.5 9.5l5.5 2M19.5 9.5l-5.5 2" />
            </svg>
            Driver
          </span>
        </div>

        {/* Seat Matrix */}
        <div className="space-y-2.5">
          {rows.map((rowNum) => (
            <div key={rowNum} className="flex items-center justify-center gap-2">
              <span className="w-5 text-center font-mono text-[10px] text-muted-foreground">
                {rowNum}
              </span>

              <div className="flex flex-1 items-center justify-center gap-2">
                {cols.map((colNum) => {
                  const seat = seatLookup.get(`${rowNum}-${colNum}`);
                  const needsAisleAfter = colNum === aisleAfterCol && cols.length > 1;

                  return (
                    <React.Fragment key={colNum}>
                      {seat ? (
                        <SeatButton
                          seat={seat}
                          isSelected={selectedSeatIds.includes(seat.id)}
                          activeGender={activeGender}
                          readOnly={readOnly}
                          onClick={() => handleToggle(seat)}
                        />
                      ) : (
                        <div className="h-12 w-12 sm:h-13 sm:w-13" aria-hidden="true" />
                      )}
                      {needsAisleAfter && <div className="w-5 sm:w-7" aria-hidden="true" />}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SeatButton({
  seat,
  isSelected,
  activeGender,
  readOnly,
  onClick,
}: {
  seat: SeatMapItem;
  isSelected: boolean;
  activeGender?: string;
  readOnly: boolean;
  onClick: () => void;
}) {
  const isAvailable = seat.status === "AVAILABLE" && seat.is_available !== false;
  const isBlocked = seat.status === "BLOCKED";
  const isLocked = seat.status === "LOCKED";
  const femaleOnly = isSeatFemaleOnly(seat);
  const allowedForGender = isSeatAllowedForGender(seat, activeGender);
  const isGenderRestricted = isAvailable && !allowedForGender;

  let stateClasses =
    "border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-500";

  if (!isAvailable && seat.occupied_gender === "FEMALE") {
    stateClasses =
      "border-fuchsia-300 bg-fuchsia-100/60 text-fuchsia-700/70 cursor-not-allowed dark:border-fuchsia-900/60 dark:bg-fuchsia-950/40 dark:text-fuchsia-400/70";
  }

  if (isSelected) {
    stateClasses =
      "border-indigo-700 bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/30 hover:bg-indigo-700";
  } else if (isGenderRestricted) {
    stateClasses =
      "border-fuchsia-300 bg-fuchsia-50/50 text-fuchsia-500/70 cursor-not-allowed opacity-70 dark:border-fuchsia-900/50 dark:bg-fuchsia-950/30 dark:text-fuchsia-400/60";
  } else if (isAvailable && femaleOnly) {
    stateClasses =
      "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-900 hover:bg-fuchsia-100 dark:bg-fuchsia-950/60 dark:text-fuchsia-200 dark:hover:bg-fuchsia-900/60";
  } else if (isAvailable) {
    stateClasses =
      "border-emerald-500 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/50";
  }

  const fareText = seat.fare !== undefined ? formatCurrencyPkr(seat.fare) : "";
  const restrictionLabel = seat.female_adjacent_restricted
    ? "Female-Only (adjacent to female passenger)"
    : seat.is_ladies_only
      ? "Ladies Only"
      : "";
  const occupiedLabel =
    !isAvailable && seat.occupied_gender ? ` · ${seat.occupied_gender}` : "";

  return (
    <button
      type="button"
      disabled={readOnly || !isAvailable || (!isSelected && isGenderRestricted)}
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={`Seat ${seat.seat_number}, ${seat.seat_type}${
        femaleOnly ? ", Ladies Only" : ""
      }, ${seat.status}${fareText ? `, ${fareText}` : ""}`}
      title={`Seat ${seat.seat_number} (${seat.seat_type.replace(/_/g, " ")})${
        restrictionLabel ? ` · ${restrictionLabel}` : ""
      }${fareText ? ` · ${fareText}` : ""} · ${seat.status}${occupiedLabel}`}
      className={cn(
        "relative flex h-12 w-12 flex-col items-center justify-center rounded-lg border-2 font-mono text-xs font-semibold transition-all sm:h-13 sm:w-14",
        !readOnly && isAvailable && !isGenderRestricted && "cursor-pointer active:scale-95",
        stateClasses
      )}
    >
      <span className="leading-none">{seat.seat_number}</span>
      <span className="mt-1 flex items-center gap-0.5 text-[9px] font-normal opacity-80">
        {isBlocked ? (
          <Ban className="h-2.5 w-2.5" />
        ) : isLocked ? (
          <Lock className="h-2.5 w-2.5" />
        ) : !isAvailable && seat.occupied_gender ? (
          <span>{seat.occupied_gender[0]}</span>
        ) : femaleOnly ? (
          <UserCheck className="h-2.5 w-2.5" />
        ) : (
          <span>{seat.seat_type === "WINDOW" ? "WIN" : seat.seat_type === "AISLE" ? "AIS" : "SLP"}</span>
        )}
      </span>
    </button>
  );
}
