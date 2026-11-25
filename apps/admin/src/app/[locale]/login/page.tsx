"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bus, LockKeyhole } from "lucide-react";
import { loginSchema, type LoginFormValues } from "@busms/config/schemas";
import { getDefaultRouteForRole } from "@busms/config/constants";
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
import { useRouter } from "@/i18n/routing";
import { LocaleSwitcher } from "@/components/locale-switcher";

function AdminLoginForm() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(() => {
    const err = searchParams.get("error");
    if (err === "unauthorized") return t("auth.unauthorizedRole");
    const reason = searchParams.get("reason");
    if (reason === "expired") return t("auth.sessionExpired");
    return null;
  });

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
      const session = await login(values.identifier, values.password);
      const nextParam = searchParams.get("next");
      const fallback = getDefaultRouteForRole(session.user.role);
      const target = nextParam && nextParam.startsWith("/") && nextParam !== "/login"
        ? nextParam
        : fallback;
      router.replace(target);
    } catch (err) {
      if (err instanceof ApiException) {
        setServerError(err.message);
      } else {
        setServerError("Unable to sign in. Verify your credentials and try again.");
      }
    }
  };

  return (
    <Card className="w-full max-w-md shadow-elevated">
          <CardHeader className="space-y-1.5">
            <div className="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl">{t("auth.adminLoginTitle")}</CardTitle>
            <CardDescription>{t("auth.adminLoginSubtitle")}</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {serverError && <Alert variant="danger">{serverError}</Alert>}

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
                <Label htmlFor="password">{t("auth.passwordLabel")}</Label>
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
          </CardContent>
        </Card>
  );
}

export default function AdminLoginPage() {
  const t = useTranslations();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex items-center justify-between border-b bg-card px-6 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Bus className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">{t("brand.opsTitle")}</span>
        </div>
        <LocaleSwitcher />
      </div>

      <div className="flex flex-1 items-center justify-center p-4">
        <Suspense fallback={<Skeleton className="h-80 w-full max-w-md" />}>
          <AdminLoginForm />
        </Suspense>
      </div>
    </div>
  );
}
