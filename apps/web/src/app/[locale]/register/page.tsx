"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { Gender, UserRole } from "@busms/config/constants";
import { registerSchema, type RegisterFormValues } from "@busms/config/schemas";
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

export default function PassengerRegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const baseUrl = getDefaultApiBaseUrl().replace(/\/$/, "");
  const [serverError, setServerError] = useState<string | null>(null);

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

  const onSubmit = async (values: RegisterFormValues) => {
    setServerError(null);
    try {
      const res = await fetch(`${baseUrl}/api/auth/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: values.full_name,
          phone: values.phone,
          email: values.email || null,
          gender: values.gender,
          password: values.password,
          role: UserRole.PASSENGER,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const msg =
          json?.error?.message ||
          Object.values(json?.error?.details || {}).flat()[0] ||
          "Registration failed.";
        setServerError(String(msg));
        return;
      }

      const phone = json.data?.user?.phone || values.phone;
      const qs = new URLSearchParams({ identifier: phone });
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
            {serverError && <Alert variant="danger">{serverError}</Alert>}

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
