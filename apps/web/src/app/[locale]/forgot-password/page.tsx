"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import {
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  type PasswordResetConfirmValues,
  type PasswordResetRequestValues,
} from "@busms/config/schemas";
import { getDefaultApiBaseUrl } from "@busms/api-client";
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
    try {
      const res = await fetch(`${baseUrl}/api/auth/password-reset-request/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setServerError(json?.error?.message || "Unable to dispatch reset OTP.");
        return;
      }
      confirmForm.setValue("identifier", values.identifier);
      setStep("confirm");
    } catch {
      setServerError("Network error requesting reset code.");
    }
  };

  const onConfirm = async (values: PasswordResetConfirmValues) => {
    setServerError(null);
    try {
      const res = await fetch(`${baseUrl}/api/auth/password-reset-confirm/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setServerError(json?.error?.message || "Invalid OTP or password.");
        return;
      }
      router.replace("/login?reset=1");
    } catch {
      setServerError("Network error confirming password reset.");
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
