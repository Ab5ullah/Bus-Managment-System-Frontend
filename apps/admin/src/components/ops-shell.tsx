"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  BarChart3,
  Bus,
  CalendarClock,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Moon,
  QrCode,
  Receipt,
  RotateCcw,
  Sun,
  Tag,
  UserCog,
  X,
} from "lucide-react";
import { canRoleAccessAdminPath } from "@busms/config/constants";
import { useAuth } from "@busms/api-client/auth";
import { Badge, Button, cn } from "@busms/ui";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { LocaleSwitcher } from "./locale-switcher";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "ops" | "network" | "commercial";
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "nav.overview", icon: LayoutDashboard, group: "ops" },
  { href: "/counter-pos", labelKey: "nav.counterPos", icon: Receipt, group: "ops" },
  { href: "/gate-scanner", labelKey: "nav.gateScanner", icon: QrCode, group: "ops" },
  { href: "/cancellations", labelKey: "nav.cancellations", icon: RotateCcw, group: "ops" },
  { href: "/staff", labelKey: "nav.staff", icon: UserCog, group: "ops" },
  { href: "/fleet", labelKey: "nav.fleet", icon: Bus, group: "network" },
  { href: "/routes", labelKey: "nav.routeCorridors", icon: MapPin, group: "network" },
  { href: "/trips", labelKey: "nav.trips", icon: CalendarClock, group: "network" },
  { href: "/promotions", labelKey: "nav.promotions", icon: Tag, group: "commercial" },
  { href: "/reports", labelKey: "nav.reports", icon: BarChart3, group: "commercial" },
];

export function OpsShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const visibleItems = NAV_ITEMS.filter((item) =>
    user?.role ? canRoleAccessAdminPath(user.role, item.href) : false
  );

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Bus className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-none">{t("brand.opsTitle")}</p>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">Dispatch & Revenue</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <div className="mb-2.5 rounded-md border bg-muted/40 px-3 py-2">
          <p className="truncate text-xs font-semibold">
            {profile?.full_name || user?.phone || "Staff"}
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <Badge variant="default" className="text-[10px]">
              {user?.role ? t(`roles.${user.role}`) : "—"}
            </Badge>
            <span className="truncate font-mono text-[11px] text-muted-foreground">
              {user?.phone}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          <span>{t("common.signOut")}</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-e bg-card lg:block">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 w-64 bg-card shadow-elevated">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute end-3 top-4 rounded p-1 text-muted-foreground hover:bg-muted"
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="text-sm font-medium text-muted-foreground">
              {t("brand.tagline")}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <LocaleSwitcher />
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
