"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, RefreshCw } from "lucide-react";
import {
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  type PasswordResetConfirmValues,
  type PasswordResetRequestValues,
} from "@busms/config/schemas";
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
} from "@busms/ui";
import { Link, useRouter } from "@/i18n/routing";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const baseUrl = getDefaultApiBaseUrl().replace(/\/$/, "");
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [serverError, setServerError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const reqForm = useForm<PasswordResetRequestValues>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { identifier: "" },
  });

  const confirmForm = useForm<PasswordResetConfirmValues>({
    resolver: zodResolver(passwordResetConfirmSchema),
    defaultValues: { identifier: "", otp_code: "", new_password: "" },
  });

  const onRequest = async (values: PasswordResetRequestValues) => {
    setServerError(null);
    setStatusMessage(null);
    try {
      const res = await fetch(`${baseUrl}${API_ENDPOINTS.AUTH.PASSWORD_RESET_REQUEST}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: values.identifier.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const fieldErrors = extractApiFieldErrors(json?.error?.details);
        if (fieldErrors.identifier) {
          reqForm.setError("identifier", { type: "server", message: fieldErrors.identifier });
        }
        setServerError(extractApiErrorMessage(json, "Unable to dispatch reset OTP."));
        return;
      }
      confirmForm.setValue("identifier", values.identifier.trim());
      setCooldown(60);
      setStatusMessage("If an account exists for that contact, a reset OTP has been dispatched.");
      setStep("confirm");
    } catch {
      setServerError("Network error requesting reset code.");
    }
  };

  const onConfirm = async (values: PasswordResetConfirmValues) => {
    setServerError(null);
    setStatusMessage(null);
    try {
      const res = await fetch(`${baseUrl}${API_ENDPOINTS.AUTH.PASSWORD_RESET_CONFIRM}`, {
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
        if (fieldErrors.otp_code) {
          confirmForm.setError("otp_code", { type: "server", message: fieldErrors.otp_code });
        }
        if (fieldErrors.new_password) {
          confirmForm.setError("new_password", { type: "server", message: fieldErrors.new_password });
        }
        setServerError(extractApiErrorMessage(json, "Invalid OTP or password."));
        return;
      }
      router.replace("/login?reset=1");
    } catch {
      setServerError("Network error confirming password reset.");
    }
  };

  const handleResendResetOtp = async () => {
    const identifier = confirmForm.getValues("identifier").trim();
    if (!identifier) return;
    setServerError(null);
    setStatusMessage(null);
    setIsResending(true);
    try {
      const res = await fetch(`${baseUrl}${API_ENDPOINTS.AUTH.RESEND_OTP}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, purpose: "PASSWORD_RESET" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const msg = extractApiErrorMessage(json, "Unable to resend reset OTP.");
        const waitMatch = msg.match(/wait\s+(\d+)\s+second/i);
        if (waitMatch?.[1]) {
          setCooldown(Number(waitMatch[1]));
        }
        setServerError(msg);
        return;
      }
      const nextCooldown = Number(json.data?.cooldown_seconds ?? 60);
      setCooldown(Number.isFinite(nextCooldown) && nextCooldown > 0 ? nextCooldown : 60);
      setStatusMessage(json.message || "A new reset OTP has been sent.");
    } catch {
      setServerError("Network error resending reset code.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md shadow-elevated">
          <CardHeader>
            <div className="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl">Reset Password</CardTitle>
            <CardDescription>
              {step === "request"
                ? "Enter your registered phone or email to receive a 6-digit reset OTP."
                : "Enter the OTP and choose a new password."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {statusMessage && <Alert variant="success">{statusMessage}</Alert>}
            {serverError && <Alert variant="danger">{serverError}</Alert>}

            {step === "request" ? (
              <form onSubmit={reqForm.handleSubmit(onRequest)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-id">Phone or Email</Label>
                  <Input
                    id="reset-id"
                    placeholder="+923001234567"
                    {...reqForm.register("identifier")}
                  />
                  {reqForm.formState.errors.identifier && (
                    <p className="text-xs text-destructive">
                      {reqForm.formState.errors.identifier.message}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={reqForm.formState.isSubmitting}>
                  {reqForm.formState.isSubmitting ? "Sending OTP..." : "Send Reset OTP"}
                </Button>
              </form>
            ) : (
              <form onSubmit={confirmForm.handleSubmit(onConfirm)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-otp">6-Digit OTP</Label>
                  <Input
                    id="confirm-otp"
                    maxLength={6}
                    className="font-mono tracking-widest"
                    {...confirmForm.register("otp_code")}
                  />
                  {confirmForm.formState.errors.otp_code && (
                    <p className="text-xs text-destructive">
                      {confirmForm.formState.errors.otp_code.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-pw">New Password</Label>
                  <Input id="new-pw" type="password" {...confirmForm.register("new_password")} />
                  {confirmForm.formState.errors.new_password && (
                    <p className="text-xs text-destructive">
                      {confirmForm.formState.errors.new_password.message}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={confirmForm.formState.isSubmitting}>
                  {confirmForm.formState.isSubmitting ? "Updating..." : "Update Password"}
                </Button>

                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-0 text-xs font-medium text-primary hover:bg-transparent hover:underline"
                    disabled={isResending || cooldown > 0}
                    onClick={handleResendResetOtp}
                  >
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isResending ? "animate-spin" : ""}`} />
                    {cooldown > 0 ? `Resend OTP (${cooldown}s)` : "Resend OTP"}
                  </Button>
                </div>
              </form>
            )}

            <p className="text-center text-xs text-muted-foreground">
              <Link href="/login" className="font-medium text-primary hover:underline">
                Back to Sign In
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>

      <SiteFooter />
    </div>
  );
}
