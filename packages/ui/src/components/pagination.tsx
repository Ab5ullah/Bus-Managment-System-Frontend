import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { cn } from "../lib/utils";

export interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

function getPageRange(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: Array<number | "ellipsis"> = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);

  if (left > 2) pages.push("ellipsis");
  for (let p = left; p <= right; p += 1) {
    pages.push(p);
  }
  if (right < total - 1) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

export function PaginationBar({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  className,
}: PaginationBarProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalCount, currentPage * pageSize);
  const pages = getPageRange(currentPage, safeTotalPages);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          Showing <strong className="text-foreground">{startItem}</strong>–
          <strong className="text-foreground">{endItem}</strong> of{" "}
          <strong className="text-foreground">{totalCount}</strong>
        </span>

        {onPageSizeChange && (
          <label className="inline-flex items-center gap-1.5">
            <span>Rows</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Rows per page"
              className="h-7 rounded border border-input bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
          <span className="sr-only sm:not-sr-only">Prev</span>
        </Button>

        {pages.map((p, idx) =>
          p === "ellipsis" ? (
            <span key={`ellipsis-${idx}`} className="px-1.5">
              …
            </span>
          ) : (
            <Button
              key={p}
              type="button"
              variant={p === currentPage ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(p)}
              aria-current={p === currentPage ? "page" : undefined}
              className="min-w-8 px-2 tabular-nums"
            >
              {p}
            </Button>
          )
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={currentPage >= safeTotalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          <span className="sr-only sm:not-sr-only">Next</span>
          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}
