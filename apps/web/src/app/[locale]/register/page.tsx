"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { Gender, UserRole } from "@busms/config/constants";
import { registerSchema, type RegisterFormValues } from "@busms/config/schemas";
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

const REGISTER_FORM_FIELDS = new Set<keyof RegisterFormValues>([
  "full_name",
  "phone",
  "email",
  "gender",
  "password",
]);

export default function PassengerRegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const baseUrl = getDefaultApiBaseUrl().replace(/\/$/, "");
  const [serverError, setServerError] = useState<string | null>(null);
  const [unverifiedIdentifier, setUnverifiedIdentifier] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: "",
      phone: "",
      email: "",
      gender: Gender.MALE,
      password: "",
      role: UserRole.PASSENGER,
    },
  });

  const handleGoToVerifyOtp = async () => {
    if (!unverifiedIdentifier) return;
    setIsSendingOtp(true);
    try {
      const res = await fetch(`${baseUrl}${API_ENDPOINTS.AUTH.RESEND_OTP}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: unverifiedIdentifier,
          purpose: "REGISTRATION",
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        const qs = new URLSearchParams({ identifier: unverifiedIdentifier, resent: "1" });
        router.push(`/verify-otp?${qs.toString()}`);
        return;
      }

      const msg = extractApiErrorMessage(json, "Could not resend verification OTP.");
      if (msg.toLowerCase().includes("already verified")) {
        setUnverifiedIdentifier(null);
        setServerError("This account is already verified. Please sign in instead.");
        return;
      }
      if (msg.toLowerCase().includes("wait")) {
        const qs = new URLSearchParams({ identifier: unverifiedIdentifier });
        router.push(`/verify-otp?${qs.toString()}`);
        return;
      }
      setServerError(msg);
    } catch {
      setServerError("Unable to reach verification service.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const onSubmit = async (values: RegisterFormValues) => {
    setServerError(null);
    setUnverifiedIdentifier(null);
    const cleanedPhone = values.phone.replace(/[\s\-]/g, "");
    try {
      const res = await fetch(`${baseUrl}${API_ENDPOINTS.AUTH.REGISTER}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: values.full_name.trim(),
          phone: cleanedPhone,
          email: values.email?.trim() || null,
          gender: values.gender,
          password: values.password,
          role: UserRole.PASSENGER,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const fieldErrors = extractApiFieldErrors(json?.error?.details);
        for (const [field, message] of Object.entries(fieldErrors)) {
          if (REGISTER_FORM_FIELDS.has(field as keyof RegisterFormValues)) {
            form.setError(field as keyof RegisterFormValues, {
              type: "server",
              message,
            });
          }
        }

        const msg = extractApiErrorMessage(
          json,
          `Registration failed (${res.status}).`
        );
        setServerError(msg);

        const phoneExists = fieldErrors.phone?.toLowerCase().includes("already exists");
        const emailExists = fieldErrors.email?.toLowerCase().includes("already exists");
        if (phoneExists || emailExists) {
          setUnverifiedIdentifier(
            emailExists && !phoneExists && values.email?.trim()
              ? values.email.trim()
              : cleanedPhone
          );
        }
        return;
      }

      const phone = json.data?.user?.phone || cleanedPhone;
      const qs = new URLSearchParams({ identifier: phone, resent: "1" });
      router.push(`/verify-otp?${qs.toString()}`);
    } catch {
      setServerError("Unable to reach registration service.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md shadow-elevated">
          <CardHeader className="space-y-1.5">
            <div className="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserPlus className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl">{t("common.register")}</CardTitle>
            <CardDescription>
              Create your passenger account to manage bookings, saved travelers, and instant refunds.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {serverError && (
              <Alert variant="danger" className="space-y-2">
                <p>{serverError}</p>
                {unverifiedIdentifier && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isSendingOtp}
                      onClick={handleGoToVerifyOtp}
                    >
                      {isSendingOtp ? "Sending OTP..." : "Verify Account (Enter OTP)"}
                    </Button>
                    <Link
                      href="/login"
                      className="text-xs font-medium underline underline-offset-2"
                    >
                      Sign in instead
                    </Link>
                  </div>
                )}
              </Alert>
            )}

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Full Name</Label>
                <Input id="full_name" placeholder="Ayesha Siddiqui" {...form.register("full_name")} />
                {form.formState.errors.full_name && (
                  <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" placeholder="+923001234567" {...form.register("phone")} />
                {form.formState.errors.phone && (
                  <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input id="email" type="email" placeholder="name@example.com" {...form.register("email")} />
                  {form.formState.errors.email && (
                    <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gender">Gender</Label>
                  <select
                    id="gender"
                    {...form.register("gender")}
                    className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  >
                    <option value={Gender.MALE}>Male</option>
                    <option value={Gender.FEMALE}>Female</option>
                    <option value={Gender.OTHER}>Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password (min 8 chars)</Label>
                <Input id="password" type="password" {...form.register("password")} />
                {form.formState.errors.password && (
                  <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? t("common.loading") : t("common.register")}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              {t("auth.haveAccount")}{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                {t("common.signIn")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>

      <SiteFooter />
    </div>
  );
}
