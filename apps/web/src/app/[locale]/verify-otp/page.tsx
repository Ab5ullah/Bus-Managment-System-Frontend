"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { verifyOtpSchema, type VerifyOtpFormValues } from "@busms/config/schemas";
import { API_ENDPOINTS, getDefaultApiBaseUrl } from "@busms/api-client";
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
import { useRouter } from "@/i18n/routing";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const baseUrl = getDefaultApiBaseUrl().replace(/\/$/, "");
  const initialIdentifier = searchParams.get("identifier") || "";

  const [serverError, setServerError] = useState<string | null>(null);

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
    try {
      const res = await fetch(`${baseUrl}${API_ENDPOINTS.AUTH.VERIFY_OTP}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setServerError(json?.error?.message || "Invalid or expired OTP code.");
        return;
      }
      router.replace("/login?verified=1");
    } catch {
      setServerError("Unable to verify OTP right now.");
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
