import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrencyPkr(amount: number | string | null | undefined): string {
  const num = typeof amount === "string" ? Number(amount) : (amount ?? 0);
  if (!Number.isFinite(num)) return "PKR 0";
  return `PKR ${new Intl.NumberFormat("en-PK", {
    maximumFractionDigits: 0,
  }).format(num)}`;
}
