"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  UserPlus,
  CheckCircle2,
} from "lucide-react";
import { Gender, UserRole } from "@busms/config/constants";
import { API_ENDPOINTS } from "@busms/config/endpoints";
import { getDefaultApiBaseUrl } from "@busms/api-client";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@busms/ui";

interface CreatedStaffUser {
  id: string;
  phone: string;
  email: string | null;
  role: string;
  role_display: string;
  is_verified: boolean;
}

export function StaffManagementClient() {
  const t = useTranslations();
  const baseUrl = getDefaultApiBaseUrl().replace(/\/$/, "");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<Gender>(Gender.MALE);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdList, setCreatedList] = useState<CreatedStaffUser[]>([]);

  const handleCreateCounterAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${baseUrl}${API_ENDPOINTS.AUTH.REGISTER}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          gender,
          password,
          role: UserRole.COUNTER_AGENT,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const msg =
          json?.error?.message ||
          Object.values(json?.error?.details || {}).flat()[0] ||
          "Failed to create staff account.";
        setError(String(msg));
        return;
      }

      if (json.data?.user) {
        setCreatedList((prev) => [json.data.user as CreatedStaffUser, ...prev]);
      }
      setFullName("");
      setPhone("");
      setEmail("");
      setPassword("");
    } catch {
      setError("Unable to reach authentication service.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("staff.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("staff.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4 text-primary" />
            <span>{t("staff.createCounterAgent")}</span>
          </CardTitle>
          <CardDescription>{t("staff.createCounterAgentDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <form onSubmit={handleCreateCounterAgent} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="staff-name">{t("staff.fullName")} *</Label>
                <Input
                  id="staff-name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Hamza Tariq"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-phone">{t("staff.phone")} *</Label>
                <Input
                  id="staff-phone"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+923001112233"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-email">{t("staff.email")}</Label>
                <Input
                  id="staff-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="agent@safarline.pk"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-gender">{t("staff.gender")}</Label>
                <select
                  id="staff-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value={Gender.MALE}>Male</option>
                  <option value={Gender.FEMALE}>Female</option>
                  <option value={Gender.OTHER}>Other</option>
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="staff-password">{t("staff.password")} *</Label>
                <Input
                  id="staff-password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                />
              </div>
            </div>

            <Button type="submit" disabled={submitting}>
              <UserPlus className="me-2 h-4 w-4" />
              {submitting ? t("common.loading") : t("staff.createBtn")}
            </Button>
          </form>

          {createdList.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("staff.recentlyCreated")}
              </h3>
              {createdList.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-emerald-50/50 p-3 text-sm dark:bg-emerald-950/20"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="font-mono font-medium">{u.phone}</span>
                    {u.email && (
                      <span className="text-xs text-muted-foreground">({u.email})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{u.role_display || u.role}</Badge>
                    <Badge variant={u.is_verified ? "success" : "warning"}>
                      {u.is_verified ? t("staff.verified") : t("staff.otpPending")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
