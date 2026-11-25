"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  X,
  CheckCircle,
  Zap,
  Save,
  AlertTriangle,
} from "lucide-react";
import {
  Button,
  Card,
  Input,
  Label,
  Skeleton,
  Alert,
  Badge,
  PaginationBar,
  formatCurrencyPkr,
} from "@busms/ui";
import { useAuth } from "@busms/api-client/auth";
import { normalizePaginated, type PaginatedData } from "@busms/api-client";
import { API_ENDPOINTS } from "@busms/config/endpoints";
import { adminFetch, formatShortDateTime } from "@/lib/admin-api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Coupon {
  id: string;
  code: string;
  description: string;
  discount_type: "PERCENTAGE" | "FIXED";
  discount_value: string;
  min_booking_amount: string;
  max_discount_amount: string | null;
  valid_from: string;
  valid_to: string;
  max_total_uses: number | null;
  max_uses_per_user: number;
  current_usage_count: number;
  is_active: boolean;
  created_at: string;
}

interface DynamicPricingRule {
  id: string;
  name: string;
  rule_type: string;
  route: string | null;
  route_code: string;
  min_occupancy_percentage: string | null;
  hours_before_departure_min: number | null;
  hours_before_departure_max: number | null;
  multiplier: string;
  priority: number;
  is_active: boolean;
  created_at: string;
}

interface CouponForm {
  code: string;
  description: string;
  discount_type: "PERCENTAGE" | "FIXED";
  discount_value: string;
  min_booking_amount: string;
  max_discount_amount: string;
  valid_from: string;
  valid_to: string;
  max_total_uses: string;
  max_uses_per_user: string;
  is_active: boolean;
}

interface DynamicRuleForm {
  name: string;
  rule_type: string;
  min_occupancy_percentage: string;
  hours_before_departure_min: string;
  hours_before_departure_max: string;
  multiplier: string;
  priority: string;
  is_active: boolean;
}

// ─── Empty forms ─────────────────────────────────────────────────────────────

const emptyCouponForm = (): CouponForm => ({
  code: "",
  description: "",
  discount_type: "PERCENTAGE",
  discount_value: "",
  min_booking_amount: "0",
  max_discount_amount: "",
  valid_from: "",
  valid_to: "",
  max_total_uses: "",
  max_uses_per_user: "1",
  is_active: true,
});

const emptyRuleForm = (): DynamicRuleForm => ({
  name: "",
  rule_type: "DEMAND_SURGE",
  min_occupancy_percentage: "",
  hours_before_departure_min: "",
  hours_before_departure_max: "",
  multiplier: "1.00",
  priority: "10",
  is_active: true,
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function todayInput() {
  return new Date().toISOString().slice(0, 16);
}

type ActiveTab = "coupons" | "yield";

export function PromotionsClient() {
  const t = useTranslations();
  const { getValidAccessToken: getToken } = useAuth();
  const qc = useQueryClient();

  const [tab, setTab] = useState<ActiveTab>("coupons");
  const [couponPage, setCouponPage] = useState(1);
  const [rulePageNum, setRulePageNum] = useState(1);

  // ── Coupon form state ──
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null);
  const [couponForm, setCouponForm] = useState<CouponForm>(emptyCouponForm);
  const [couponError, setCouponError] = useState("");

  // ── Yield rule form state ──
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editRule, setEditRule] = useState<DynamicPricingRule | null>(null);
  const [ruleForm, setRuleForm] = useState<DynamicRuleForm>(emptyRuleForm);
  const [ruleError, setRuleError] = useState("");

  // ─── Coupons query ────────────────────────────────────────────────────────

  const couponsQuery = useQuery({
    queryKey: ["coupons", couponPage],
    queryFn: async () => {
      const raw = await adminFetch<PaginatedData<Coupon> | Coupon[] | { coupons?: Coupon[] }>(
        `${API_ENDPOINTS.PROMOTIONS.ADMIN_COUPONS}?page=${couponPage}&page_size=10`,
        getToken
      );
      const unwrapped: PaginatedData<Coupon> | Coupon[] =
        raw && typeof raw === "object" && !Array.isArray(raw) && "coupons" in raw
          ? (raw.coupons ?? [])
          : (raw as PaginatedData<Coupon> | Coupon[]);
      return normalizePaginated(unwrapped, 10);
    },
  });

  // ─── Dynamic rules query ──────────────────────────────────────────────────

  const rulesQuery = useQuery({
    queryKey: ["dynamic-rules", rulePageNum],
    queryFn: async () => {
      const raw = await adminFetch<
        PaginatedData<DynamicPricingRule> | DynamicPricingRule[] | { rules?: DynamicPricingRule[] }
      >(
        `${API_ENDPOINTS.PROMOTIONS.ADMIN_DYNAMIC_RULES}?page=${rulePageNum}&page_size=10`,
        getToken
      );
      const unwrapped: PaginatedData<DynamicPricingRule> | DynamicPricingRule[] =
        raw && typeof raw === "object" && !Array.isArray(raw) && "rules" in raw
          ? (raw.rules ?? [])
          : (raw as PaginatedData<DynamicPricingRule> | DynamicPricingRule[]);
      return normalizePaginated(unwrapped, 10);
    },
  });

  // ─── Coupon CRUD ──────────────────────────────────────────────────────────

  const saveCouponMutation = useMutation({
    mutationFn: async (form: CouponForm) => {
      const payload = {
        ...form,
        discount_value: form.discount_value,
        min_booking_amount: form.min_booking_amount || "0",
        max_discount_amount: form.max_discount_amount || null,
        max_total_uses: form.max_total_uses ? Number(form.max_total_uses) : null,
        max_uses_per_user: Number(form.max_uses_per_user),
      };
      if (editCoupon) {
        return adminFetch(API_ENDPOINTS.PROMOTIONS.adminCouponDetail(editCoupon.id), getToken, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      return adminFetch(API_ENDPOINTS.PROMOTIONS.ADMIN_COUPONS, getToken, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coupons"] });
      setShowCouponForm(false);
      setEditCoupon(null);
      setCouponForm(emptyCouponForm());
      setCouponError("");
    },
    onError: (err: Error) => setCouponError(err.message),
  });

  const deleteCouponMutation = useMutation({
    mutationFn: (id: string) =>
      adminFetch(API_ENDPOINTS.PROMOTIONS.adminCouponDetail(id), getToken, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });

  // ─── Dynamic rule CRUD ────────────────────────────────────────────────────

  const saveRuleMutation = useMutation({
    mutationFn: async (form: DynamicRuleForm) => {
      const payload = {
        name: form.name,
        rule_type: form.rule_type,
        min_occupancy_percentage: form.min_occupancy_percentage || null,
        hours_before_departure_min: form.hours_before_departure_min
          ? Number(form.hours_before_departure_min)
          : null,
        hours_before_departure_max: form.hours_before_departure_max
          ? Number(form.hours_before_departure_max)
          : null,
        multiplier: form.multiplier,
        priority: Number(form.priority),
        is_active: form.is_active,
        route: null,
      };
      if (editRule) {
        return adminFetch(API_ENDPOINTS.PROMOTIONS.adminDynamicRuleDetail(editRule.id), getToken, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      return adminFetch(API_ENDPOINTS.PROMOTIONS.ADMIN_DYNAMIC_RULES, getToken, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dynamic-rules"] });
      setShowRuleForm(false);
      setEditRule(null);
      setRuleForm(emptyRuleForm());
      setRuleError("");
    },
    onError: (err: Error) => setRuleError(err.message),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) =>
      adminFetch(API_ENDPOINTS.PROMOTIONS.adminDynamicRuleDetail(id), getToken, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dynamic-rules"] }),
  });

  // ─── Coupon form helpers ──────────────────────────────────────────────────

  const openCouponEdit = (c: Coupon) => {
    setEditCoupon(c);
    setCouponForm({
      code: c.code,
      description: c.description,
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      min_booking_amount: c.min_booking_amount,
      max_discount_amount: c.max_discount_amount ?? "",
      valid_from: c.valid_from.slice(0, 16),
      valid_to: c.valid_to.slice(0, 16),
      max_total_uses: c.max_total_uses?.toString() ?? "",
      max_uses_per_user: String(c.max_uses_per_user),
      is_active: c.is_active,
    });
    setShowCouponForm(true);
    setCouponError("");
  };

  const openRuleEdit = (r: DynamicPricingRule) => {
    setEditRule(r);
    setRuleForm({
      name: r.name,
      rule_type: r.rule_type,
      min_occupancy_percentage: r.min_occupancy_percentage ?? "",
      hours_before_departure_min: r.hours_before_departure_min?.toString() ?? "",
      hours_before_departure_max: r.hours_before_departure_max?.toString() ?? "",
      multiplier: r.multiplier,
      priority: String(r.priority),
      is_active: r.is_active,
    });
    setShowRuleForm(true);
    setRuleError("");
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("promo.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("promo.subtitle")}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
        {(["coupons", "yield"] as ActiveTab[]).map((tabId) => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === tabId
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tabId === "coupons" ? (
              <Tag className="h-4 w-4" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {tabId === "coupons" ? t("promo.couponsTab") : t("promo.yieldTab")}
          </button>
        ))}
      </div>

      {/* ═══ COUPONS TAB ══════════════════════════════════════════════════════ */}
      {tab === "coupons" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setEditCoupon(null);
                setCouponForm(emptyCouponForm());
                setShowCouponForm(true);
                setCouponError("");
              }}
            >
              <Plus className="me-2 h-4 w-4" />
              {t("promo.newCoupon")}
            </Button>
          </div>

          {/* Coupon form */}
          {showCouponForm && (
            <Card className="p-5">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-semibold">
                  {editCoupon ? t("promo.editCoupon") : t("promo.newCoupon")}
                </h2>
                <button
                  onClick={() => setShowCouponForm(false)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {couponError && (
                <Alert variant="danger" className="mb-4">
                  <span>{couponError}</span>
                </Alert>
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>{t("promo.code")} *</Label>
                  <Input
                    value={couponForm.code}
                    onChange={(e) =>
                      setCouponForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                    }
                    placeholder="SUMMER20"
                    className="font-mono uppercase"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                  <Label>{t("promo.description")}</Label>
                  <Input
                    value={couponForm.description}
                    onChange={(e) =>
                      setCouponForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder={t("promo.descriptionPlaceholder")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("promo.discountType")}</Label>
                  <select
                    value={couponForm.discount_type}
                    onChange={(e) =>
                      setCouponForm((f) => ({
                        ...f,
                        discount_type: e.target.value as "PERCENTAGE" | "FIXED",
                      }))
                    }
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="PERCENTAGE">{t("promo.percentage")}</option>
                    <option value="FIXED">{t("promo.fixedAmount")}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>
                    {couponForm.discount_type === "PERCENTAGE"
                      ? t("promo.discountPct")
                      : t("promo.discountAmt")}
                    *
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max={couponForm.discount_type === "PERCENTAGE" ? "100" : undefined}
                    step="0.01"
                    value={couponForm.discount_value}
                    onChange={(e) =>
                      setCouponForm((f) => ({ ...f, discount_value: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("promo.maxDiscount")}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={couponForm.max_discount_amount}
                    onChange={(e) =>
                      setCouponForm((f) => ({ ...f, max_discount_amount: e.target.value }))
                    }
                    placeholder={t("promo.unlimited")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("promo.minBooking")}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={couponForm.min_booking_amount}
                    onChange={(e) =>
                      setCouponForm((f) => ({ ...f, min_booking_amount: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("promo.validFrom")}</Label>
                  <Input
                    type="datetime-local"
                    value={couponForm.valid_from}
                    onChange={(e) =>
                      setCouponForm((f) => ({ ...f, valid_from: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("promo.validTo")}</Label>
                  <Input
                    type="datetime-local"
                    value={couponForm.valid_to}
                    onChange={(e) =>
                      setCouponForm((f) => ({ ...f, valid_to: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("promo.maxTotalUses")}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={couponForm.max_total_uses}
                    onChange={(e) =>
                      setCouponForm((f) => ({ ...f, max_total_uses: e.target.value }))
                    }
                    placeholder={t("promo.unlimited")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("promo.maxPerUser")}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={couponForm.max_uses_per_user}
                    onChange={(e) =>
                      setCouponForm((f) => ({ ...f, max_uses_per_user: e.target.value }))
                    }
                  />
                </div>
                <div className="flex items-end pb-0.5">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={couponForm.is_active}
                      onChange={(e) =>
                        setCouponForm((f) => ({ ...f, is_active: e.target.checked }))
                      }
                      className="h-4 w-4 rounded"
                    />
                    {t("promo.activeStatus")}
                  </label>
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowCouponForm(false)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={() => saveCouponMutation.mutate(couponForm)}
                  disabled={
                    !couponForm.code ||
                    !couponForm.discount_value ||
                    saveCouponMutation.isPending
                  }
                >
                  <Save className="me-2 h-4 w-4" />
                  {saveCouponMutation.isPending ? t("common.loading") : t("common.save")}
                </Button>
              </div>
            </Card>
          )}

          {/* Coupon list */}
          {couponsQuery.isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                      <th className="px-4 py-3 text-start font-medium">{t("promo.code")}</th>
                      <th className="px-4 py-3 text-start font-medium">{t("promo.description")}</th>
                      <th className="px-4 py-3 text-start font-medium">{t("promo.discount")}</th>
                      <th className="px-4 py-3 text-start font-medium">{t("promo.validity")}</th>
                      <th className="px-4 py-3 text-start font-medium">{t("promo.usage")}</th>
                      <th className="px-4 py-3 text-start font-medium">{t("common.status")}</th>
                      <th className="px-4 py-3 text-end font-medium">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(couponsQuery.data?.results ?? []).map((coupon) => (
                      <tr key={coupon.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold">{coupon.code}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                          {coupon.description}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium">
                            {coupon.discount_type === "PERCENTAGE"
                              ? `${coupon.discount_value}%`
                              : formatCurrencyPkr(Number(coupon.discount_value))}
                          </span>
                          {coupon.max_discount_amount && (
                            <span className="ms-1 text-xs text-muted-foreground">
                              (max {formatCurrencyPkr(Number(coupon.max_discount_amount))})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          <div>{formatShortDateTime(coupon.valid_from)}</div>
                          <div>→ {formatShortDateTime(coupon.valid_to)}</div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {coupon.current_usage_count}
                          {coupon.max_total_uses
                            ? ` / ${coupon.max_total_uses}`
                            : " / ∞"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={coupon.is_active ? "success" : "neutral"}
                            className="text-[10px]"
                          >
                            {coupon.is_active ? t("promo.active") : t("promo.inactive")}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-end">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openCouponEdit(coupon)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => {
                                if (confirm(t("promo.deleteConfirm"))) {
                                  deleteCouponMutation.mutate(coupon.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(couponsQuery.data?.results ?? []).length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                          {t("promo.noCoupons")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          <PaginationBar
            currentPage={couponPage}
            totalPages={Math.ceil((couponsQuery.data?.count ?? 0) / 10)}
            totalCount={couponsQuery.data?.count ?? 0}
            pageSize={10}
            onPageChange={setCouponPage}
          />
        </div>
      )}

      {/* ═══ YIELD PRICING TAB ════════════════════════════════════════════════ */}
      {tab === "yield" && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <Alert className="flex-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="ms-2 text-sm">{t("promo.yieldWarning")}</span>
            </Alert>
            <Button
              onClick={() => {
                setEditRule(null);
                setRuleForm(emptyRuleForm());
                setShowRuleForm(true);
                setRuleError("");
              }}
            >
              <Plus className="me-2 h-4 w-4" />
              {t("promo.newRule")}
            </Button>
          </div>

          {/* Rule form */}
          {showRuleForm && (
            <Card className="p-5">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-semibold">
                  {editRule ? t("promo.editRule") : t("promo.newRule")}
                </h2>
                <button
                  onClick={() => setShowRuleForm(false)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {ruleError && (
                <Alert variant="danger" className="mb-4">
                  <span>{ruleError}</span>
                </Alert>
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>{t("promo.ruleName")} *</Label>
                  <Input
                    value={ruleForm.name}
                    onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder={t("promo.ruleNamePlaceholder")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("promo.ruleType")}</Label>
                  <select
                    value={ruleForm.rule_type}
                    onChange={(e) => setRuleForm((f) => ({ ...f, rule_type: e.target.value }))}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="DEMAND_SURGE">Demand Surge</option>
                    <option value="EARLY_BIRD">Early Bird</option>
                    <option value="LAST_MINUTE">Last Minute</option>
                    <option value="PEAK_HOUR">Peak Hour</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("promo.multiplier")} *</Label>
                  <Input
                    type="number"
                    min="0.01"
                    max="10"
                    step="0.01"
                    value={ruleForm.multiplier}
                    onChange={(e) => setRuleForm((f) => ({ ...f, multiplier: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("promo.minOccupancy")} (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={ruleForm.min_occupancy_percentage}
                    onChange={(e) =>
                      setRuleForm((f) => ({ ...f, min_occupancy_percentage: e.target.value }))
                    }
                    placeholder="70"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("promo.hoursMin")}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={ruleForm.hours_before_departure_min}
                    onChange={(e) =>
                      setRuleForm((f) => ({ ...f, hours_before_departure_min: e.target.value }))
                    }
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("promo.hoursMax")}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={ruleForm.hours_before_departure_max}
                    onChange={(e) =>
                      setRuleForm((f) => ({ ...f, hours_before_departure_max: e.target.value }))
                    }
                    placeholder="24"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("promo.priority")}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={ruleForm.priority}
                    onChange={(e) => setRuleForm((f) => ({ ...f, priority: e.target.value }))}
                  />
                </div>
                <div className="flex items-end pb-0.5">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={ruleForm.is_active}
                      onChange={(e) =>
                        setRuleForm((f) => ({ ...f, is_active: e.target.checked }))
                      }
                      className="h-4 w-4 rounded"
                    />
                    {t("promo.activeStatus")}
                  </label>
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowRuleForm(false)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={() => saveRuleMutation.mutate(ruleForm)}
                  disabled={!ruleForm.name || !ruleForm.multiplier || saveRuleMutation.isPending}
                >
                  <Save className="me-2 h-4 w-4" />
                  {saveRuleMutation.isPending ? t("common.loading") : t("common.save")}
                </Button>
              </div>
            </Card>
          )}

          {/* Rules list */}
          {rulesQuery.isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                      <th className="px-4 py-3 text-start font-medium">{t("promo.ruleName")}</th>
                      <th className="px-4 py-3 text-start font-medium">{t("promo.ruleType")}</th>
                      <th className="px-4 py-3 text-start font-medium">{t("promo.multiplier")}</th>
                      <th className="px-4 py-3 text-start font-medium">{t("promo.conditions")}</th>
                      <th className="px-4 py-3 text-start font-medium">{t("promo.priority")}</th>
                      <th className="px-4 py-3 text-start font-medium">{t("common.status")}</th>
                      <th className="px-4 py-3 text-end font-medium">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(rulesQuery.data?.results ?? []).map((rule) => (
                      <tr key={rule.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{rule.name}</td>
                        <td className="px-4 py-3">
                          <Badge variant="info" className="text-xs">
                            {rule.rule_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold">
                          {Number(rule.multiplier) > 1 ? (
                            <span className="text-orange-600">×{rule.multiplier}</span>
                          ) : (
                            <span className="text-green-600">×{rule.multiplier}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {rule.min_occupancy_percentage && (
                            <div>Occ ≥ {rule.min_occupancy_percentage}%</div>
                          )}
                          {rule.hours_before_departure_min != null &&
                            rule.hours_before_departure_max != null && (
                              <div>
                                {rule.hours_before_departure_min}–
                                {rule.hours_before_departure_max}h before
                              </div>
                            )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{rule.priority}</td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={rule.is_active ? "success" : "neutral"}
                            className="text-[10px]"
                          >
                            {rule.is_active ? t("promo.active") : t("promo.inactive")}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-end">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openRuleEdit(rule)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => {
                                if (confirm(t("promo.deleteConfirm"))) {
                                  deleteRuleMutation.mutate(rule.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(rulesQuery.data?.results ?? []).length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                          {t("promo.noRules")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <PaginationBar
            currentPage={rulePageNum}
            totalPages={Math.ceil((rulesQuery.data?.count ?? 0) / 10)}
            totalCount={rulesQuery.data?.count ?? 0}
            pageSize={10}
            onPageChange={setRulePageNum}
          />
        </div>
      )}
    </div>
  );
}
