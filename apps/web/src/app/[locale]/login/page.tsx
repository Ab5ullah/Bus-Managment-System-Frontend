"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LockKeyhole } from "lucide-react";
import { loginSchema, type LoginFormValues } from "@busms/config/schemas";
import { ApiException } from "@busms/api-client";
import { useAuth } from "@busms/api-client/auth";
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

function PassengerLoginForm() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const verified = searchParams.get("verified") === "1";
  const resetDone = searchParams.get("reset") === "1";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    try {
      await login(values.identifier, values.password);
      const nextParam = searchParams.get("next");
      router.replace(nextParam && nextParam.startsWith("/") ? nextParam : "/account");
    } catch (err) {
      if (
        err instanceof ApiException &&
        (err.code === "ACCOUNT_NOT_VERIFIED" ||
          err.message.toLowerCase().includes("not verified"))
      ) {
        const details = err.details as { identifier?: string; otp_resent?: boolean };
        const targetId = details?.identifier || values.identifier.trim();
        const qs = new URLSearchParams({
          identifier: targetId,
          unverified: "1",
        });
        if (details?.otp_resent) {
          qs.set("resent", "1");
        }
        const nextParam = searchParams.get("next");
        if (nextParam && nextParam.startsWith("/")) {
          qs.set("next", nextParam);
        }
        router.push(`/verify-otp?${qs.toString()}`);
        return;
      }
      setServerError(err instanceof ApiException ? err.message : "Invalid credentials.");
    }
  };

  return (
    <Card className="w-full max-w-md shadow-elevated">
          <CardHeader className="space-y-1.5">
            <div className="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl">{t("auth.loginTitle")}</CardTitle>
            <CardDescription>{t("auth.loginSubtitle")}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {verified && (
              <Alert variant="success">Account verified successfully. You may now sign in.</Alert>
            )}
            {resetDone && (
              <Alert variant="success">Password updated successfully. Sign in with your new password.</Alert>
            )}
            {serverError && <Alert variant="danger">{serverError}</Alert>}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="identifier">{t("auth.identifierLabel")}</Label>
                <Input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder={t("auth.identifierPlaceholder")}
                  {...register("identifier")}
                />
                {errors.identifier && (
                  <p className="text-xs text-destructive">{errors.identifier.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t("auth.passwordLabel")}</Label>
                  <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                    {t("auth.forgotPassword")}
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t("auth.passwordPlaceholder")}
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? t("common.loading") : t("common.signIn")}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              {t("auth.noAccount")}{" "}
              <Link href="/register" className="font-medium text-primary hover:underline">
                {t("common.register")}
              </Link>
            </p>
          </CardContent>
        </Card>
  );
}

export default function PassengerLoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Suspense fallback={<Skeleton className="h-96 w-full max-w-md" />}>
          <PassengerLoginForm />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
