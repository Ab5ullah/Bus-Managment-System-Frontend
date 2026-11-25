import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/10 text-primary",
        neutral: "border-border bg-muted text-muted-foreground",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300",
        warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-300",
        danger: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/60 dark:text-rose-300",
        info: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/60 dark:text-sky-300",
        ladies: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-900/60 dark:bg-fuchsia-950/60 dark:text-fuchsia-300",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const STATUS_VARIANT_MAP: Record<string, BadgeProps["variant"]> = {
  CONFIRMED: "success",
  COMPLETED: "success",
  ACTIVE: "success",
  SUCCESS: "success",
  BOARDED: "success",
  ISSUED: "info",
  SCHEDULED: "info",
  BOARDING: "warning",
  PENDING: "warning",
  INITIATED: "warning",
  MAINTENANCE: "warning",
  PARTIALLY_CANCELLED: "warning",
  DEPARTED: "default",
  CANCELLED: "danger",
  FAILED: "danger",
  REFUNDED: "neutral",
  NO_SHOW: "danger",
  EXPIRED: "neutral",
  RETIRED: "neutral",
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const variant = STATUS_VARIANT_MAP[status] ?? "neutral";
  return (
    <Badge variant={variant} className={className}>
      {label ?? status.replace(/_/g, " ")}
    </Badge>
  );
}
