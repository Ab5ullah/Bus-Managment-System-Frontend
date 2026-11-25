import * as React from "react";
import { cn } from "../lib/utils";

export function Alert({
  variant = "neutral",
  className,
  children,
}: {
  variant?: "neutral" | "success" | "warning" | "danger" | "info";
  className?: string;
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    neutral: "border-border bg-muted/60 text-foreground",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200",
    warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-200",
    danger: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-200",
    info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/50 dark:text-sky-200",
  };

  return (
    <div
      role="alert"
      className={cn("rounded-md border px-4 py-3 text-sm", styles[variant], className)}
    >
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}
