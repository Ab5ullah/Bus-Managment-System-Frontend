"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { verifyOtpSchema, type VerifyOtpFormValues } from "@busms/config/schemas";
import {
  API_ENDPOINTS,
  extractApiErrorMessage,
  extractApiFieldErrors,
  getDefaultApiBaseUrl,
} from "@busms/api-client";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
} from "@busms/ui";
import { Link, useRouter } from "@/i18n/routing";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const baseUrl = getDefaultApiBaseUrl().replace(/\/$/, "");
  const initialIdentifier = searchParams.get("identifier") || "";
  const justSent = searchParams.get("resent") === "1";
  const fromUnverifiedLogin = searchParams.get("unverified") === "1";
  const nextParam = searchParams.get("next");

  const [serverError, setServerError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(
    fromUnverifiedLogin
      ? justSent
        ? "Your account is not verified yet. A fresh 6-digit OTP has been sent to your phone/email."
        : "Your account is not verified yet. Enter the 6-digit OTP sent to your phone/email, or click Resend OTP."
      : justSent
        ? "A 6-digit verification OTP has been sent to your phone/email."
        : null
  );
  const [cooldown, setCooldown] = useState<number>(justSent ? 60 : 0);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const form = useForm({
    resolver: zodResolver(verifyOtpSchema),
    defaultValues: {
      identifier: initialIdentifier,
      otp_code: "",
      purpose: "REGISTRATION" as const,
    },
  });

  const onSubmit = async (values: VerifyOtpFormValues) => {
    setServerError(null);
    setStatusMessage(null);
    try {
      const res = await fetch(`${baseUrl}${API_ENDPOINTS.AUTH.VERIFY_OTP}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          identifier: values.identifier.trim(),
          otp_code: values.otp_code.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const fieldErrors = extractApiFieldErrors(json?.error?.details);
        if (fieldErrors.identifier) {
          form.setError("identifier", { type: "server", message: fieldErrors.identifier });
        }
        if (fieldErrors.otp_code) {
          form.setError("otp_code", { type: "server", message: fieldErrors.otp_code });
        }
        setServerError(extractApiErrorMessage(json, "Invalid or expired OTP code."));
        return;
      }
      const loginQs = new URLSearchParams({ verified: "1" });
      if (nextParam && nextParam.startsWith("/")) {
        loginQs.set("next", nextParam);
      }
      router.replace(`/login?${loginQs.toString()}`);
    } catch {
      setServerError("Unable to verify OTP right now.");
    }
  };

  const handleResendOtp = async () => {
    const identifier = form.getValues("identifier").trim();
    if (!identifier) {
      form.setError("identifier", { type: "manual", message: "Enter your phone or email first." });
      return;
    }

    setServerError(null);
    setStatusMessage(null);
    setIsResending(true);
    try {
      const res = await fetch(`${baseUrl}${API_ENDPOINTS.AUTH.RESEND_OTP}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          purpose: form.getValues("purpose") || "REGISTRATION",
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const msg = extractApiErrorMessage(json, "Unable to resend OTP.");
        const waitMatch = msg.match(/wait\s+(\d+)\s+second/i);
        if (waitMatch?.[1]) {
          setCooldown(Number(waitMatch[1]));
        }
        setServerError(msg);
        return;
      }

      const nextCooldown = Number(json.data?.cooldown_seconds ?? 60);
      setCooldown(Number.isFinite(nextCooldown) && nextCooldown > 0 ? nextCooldown : 60);
      setStatusMessage(json.message || "A new OTP has been sent to your phone/email.");
    } catch {
      setServerError("Unable to reach OTP service right now.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-elevated">
      <CardHeader>
        <div className="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <CardTitle className="text-xl">Verify Your Account</CardTitle>
        <CardDescription>Enter the 6-digit verification code sent to your phone/email.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {statusMessage && <Alert variant="success">{statusMessage}</Alert>}
        {serverError && <Alert variant="danger">{serverError}</Alert>}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="identifier">Phone / Email</Label>
            <Input id="identifier" {...form.register("identifier")} />
            {form.formState.errors.identifier && (
              <p className="text-xs text-destructive">{form.formState.errors.identifier.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="otp_code">6-Digit OTP</Label>
            <Input
              id="otp_code"
              maxLength={6}
              className="font-mono tracking-widest"
              placeholder="123456"
              {...form.register("otp_code")}
            />
            {form.formState.errors.otp_code && (
              <p className="text-xs text-destructive">{form.formState.errors.otp_code.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Verifying..." : "Activate Account"}
          </Button>
        </form>

        <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-0 text-xs font-medium text-primary hover:bg-transparent hover:underline"
            disabled={isResending || cooldown > 0}
            onClick={handleResendOtp}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isResending ? "animate-spin" : ""}`} />
            {cooldown > 0 ? `Resend OTP (${cooldown}s)` : "Resend OTP"}
          </Button>

          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to Sign In
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VerifyOtpPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Suspense fallback={<Skeleton className="h-80 w-full max-w-md" />}>
          <VerifyOtpForm />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
