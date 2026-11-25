import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Button, PaginationBar, StatusBadge, formatCurrencyPkr } from "../index";

describe("@busms/ui primitives", () => {
  it("formats PKR currency cleanly", () => {
    expect(formatCurrencyPkr(2450)).toBe("PKR 2,450");
    expect(formatCurrencyPkr("1500.00")).toBe("PKR 1,500");
    expect(formatCurrencyPkr(null)).toBe("PKR 0");
  });

  it("renders Button and StatusBadge", () => {
    render(
      <div>
        <Button>Book Seat</Button>
        <StatusBadge status="CONFIRMED" />
      </div>
    );
    expect(screen.getByRole("button", { name: "Book Seat" })).toBeTruthy();
    expect(screen.getByText("CONFIRMED")).toBeTruthy();
  });

  it("renders PaginationBar and triggers page changes", () => {
    const onPageChange = vi.fn();
    render(
      <PaginationBar
        currentPage={2}
        totalPages={5}
        totalCount={95}
        pageSize={20}
        onPageChange={onPageChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
