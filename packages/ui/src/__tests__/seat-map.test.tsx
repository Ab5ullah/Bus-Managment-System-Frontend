import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { SeatMap, LockCountdown, formatCountdown, type SeatMapItem } from "../index";

const SAMPLE_SEATS: SeatMapItem[] = [
  { id: "s1", seat_number: "1A", row: 1, column: 1, deck: 1, seat_type: "WINDOW", is_ladies_only: false, status: "AVAILABLE", fare: "2500" },
  { id: "s2", seat_number: "1B", row: 1, column: 2, deck: 1, seat_type: "AISLE", is_ladies_only: true, status: "AVAILABLE", fare: "2500" },
  { id: "s3", seat_number: "1C", row: 1, column: 3, deck: 1, seat_type: "AISLE", is_ladies_only: false, status: "BOOKED", fare: "2500" },
  { id: "s4", seat_number: "1D", row: 1, column: 4, deck: 1, seat_type: "WINDOW", is_ladies_only: false, status: "LOCKED", fare: "2500" },
  { id: "s5", seat_number: "U1", row: 1, column: 1, deck: 2, seat_type: "SLEEPER_UPPER", is_ladies_only: false, status: "AVAILABLE", fare: "3200" },
];

describe("<SeatMap />", () => {
  it("renders deck tabs for multi-deck coaches and toggles seat selection", () => {
    const onSelectionChange = vi.fn();
    render(
      <SeatMap
        seats={SAMPLE_SEATS}
        selectedSeatIds={[]}
        onSelectionChange={onSelectionChange}
      />
    );

    expect(screen.getByRole("button", { name: "Lower Deck" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Upper Deck" })).toBeTruthy();

    const seat1A = screen.getByRole("button", { name: /Seat 1A/i });
    const seat1C = screen.getByRole("button", { name: /Seat 1C/i }) as HTMLButtonElement;
    const seat1D = screen.getByRole("button", { name: /Seat 1D/i }) as HTMLButtonElement;

    expect(seat1C.disabled).toBe(true);
    expect(seat1D.disabled).toBe(true);

    fireEvent.click(seat1A);
    expect(onSelectionChange).toHaveBeenCalledWith(["s1"]);

    // Switch to Upper Deck
    fireEvent.click(screen.getByRole("button", { name: "Upper Deck" }));
    expect(screen.getByRole("button", { name: /Seat U1/i })).toBeTruthy();
  });

  it("enforces maxSeats selection limit", () => {
    const onSelectionChange = vi.fn();
    render(
      <SeatMap
        seats={SAMPLE_SEATS}
        selectedSeatIds={["s1"]}
        maxSeats={1}
        onSelectionChange={onSelectionChange}
      />
    );

    const seat1B = screen.getByRole("button", { name: /Seat 1B.*Ladies Only/i });
    fireEvent.click(seat1B);
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("up to 1 seats");
  });

  it("blocks male selection on female-adjacent restricted seats while allowing female and across-aisle male", () => {
    const dynamicSeats: SeatMapItem[] = [
      {
        id: "1a",
        seat_number: "1A",
        row: 1,
        column: 1,
        deck: 1,
        seat_type: "WINDOW",
        is_ladies_only: false,
        status: "BOOKED",
        is_available: false,
        occupied_gender: "FEMALE",
        female_adjacent_restricted: false,
        allowed_genders: [],
      },
      {
        id: "1b",
        seat_number: "1B",
        row: 1,
        column: 2,
        deck: 1,
        seat_type: "AISLE",
        is_ladies_only: false,
        status: "AVAILABLE",
        is_available: true,
        occupied_gender: null,
        female_adjacent_restricted: true,
        allowed_genders: ["FEMALE"],
      },
      {
        id: "1c",
        seat_number: "1C",
        row: 1,
        column: 3,
        deck: 1,
        seat_type: "AISLE",
        is_ladies_only: false,
        status: "AVAILABLE",
        is_available: true,
        occupied_gender: null,
        female_adjacent_restricted: false,
        allowed_genders: ["MALE", "FEMALE", "OTHER"],
      },
    ];

    const onMaleSelect = vi.fn();
    const { container, rerender } = render(
      <SeatMap
        seats={dynamicSeats}
        selectedSeatIds={[]}
        activeGender="MALE"
        onSelectionChange={onMaleSelect}
      />
    );

    const view = within(container);
    const seat1B = view.getByRole("button", { name: /Seat 1B/i }) as HTMLButtonElement;
    const seat1C = view.getByRole("button", { name: /Seat 1C/i }) as HTMLButtonElement;

    expect(seat1B.disabled).toBe(true);
    expect(seat1C.disabled).toBe(false);

    fireEvent.click(seat1B);
    expect(onMaleSelect).not.toHaveBeenCalled();

    fireEvent.click(seat1C);
    expect(onMaleSelect).toHaveBeenCalledWith(["1c"]);

    const onFemaleSelect = vi.fn();
    rerender(
      <SeatMap
        seats={dynamicSeats}
        selectedSeatIds={[]}
        activeGender="FEMALE"
        onSelectionChange={onFemaleSelect}
      />
    );

    const seat1BForFemale = view.getByRole("button", { name: /Seat 1B/i }) as HTMLButtonElement;
    expect(seat1BForFemale.disabled).toBe(false);
    fireEvent.click(seat1BForFemale);
    expect(onFemaleSelect).toHaveBeenCalledWith(["1b"]);
  });
});

describe("<LockCountdown />", () => {
  it("formats MM:SS cleanly and renders timer", () => {
    expect(formatCountdown(600)).toBe("10:00");
    expect(formatCountdown(65)).toBe("01:05");
    expect(formatCountdown(0)).toBe("00:00");

    const futureIso = new Date(Date.now() + 180_000).toISOString();
    render(<LockCountdown lockedUntil={futureIso} />);
    expect(screen.getByRole("timer").textContent).toMatch(/^0[23]:\d{2}$/);
  });
});
