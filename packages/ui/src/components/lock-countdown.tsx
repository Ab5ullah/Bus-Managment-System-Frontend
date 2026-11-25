"use client";

import React, { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "../lib/utils";

export interface LockCountdownProps {
  lockedUntil: string;
  onExpire?: () => void;
  className?: string;
}

function calcRemainingSeconds(lockedUntil: string): number {
  const target = new Date(lockedUntil).getTime();
  if (Number.isNaN(target)) return 0;
  return Math.max(0, Math.floor((target - Date.now()) / 1000));
}

export function formatCountdown(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function LockCountdown({ lockedUntil, onExpire, className }: LockCountdownProps) {
  const [remaining, setRemaining] = useState<number>(() => calcRemainingSeconds(lockedUntil));
  const expiredNotifiedRef = useRef(false);

  useEffect(() => {
    expiredNotifiedRef.current = false;
    setRemaining(calcRemainingSeconds(lockedUntil));

    const timer = window.setInterval(() => {
      const next = calcRemainingSeconds(lockedUntil);
      setRemaining(next);
      if (next <= 0 && !expiredNotifiedRef.current) {
        expiredNotifiedRef.current = true;
        window.clearInterval(timer);
        onExpire?.();
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [lockedUntil, onExpire]);

  const isCritical = remaining <= 45;
  const isWarning = remaining > 45 && remaining <= 120;

  return (
    <div
      role="timer"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-sm font-semibold tabular-nums",
        isCritical
          ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300"
          : isWarning
            ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
            : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300",
        className
      )}
    >
      <Clock className="h-4 w-4" />
      <span>{formatCountdown(remaining)}</span>
    </div>
  );
}
