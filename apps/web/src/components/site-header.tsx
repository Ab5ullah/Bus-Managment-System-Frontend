"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Bus, Menu, Ticket, User, X } from "lucide-react";
import { useAuth } from "@busms/api-client/auth";
import { Button, cn } from "@busms/ui";
import { Link, usePathname } from "@/i18n/routing";
import { LocaleSwitcher } from "./locale-switcher";

export function SiteHeader() {
  const t = useTranslations();
  const pathname = usePathname();
  const { isAuthenticated, user, profile } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: "/", label: t("nav.home") },
    { href: "/routes", label: t("nav.routes") },
    { href: "/terminals", label: t("nav.terminals") },
    { href: "/faq", label: t("nav.faq") },
    { href: "/contact", label: t("nav.contact") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Bus className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-sm font-semibold leading-none tracking-tight">
                {t("brand.name")}
              </span>
              <span className="mt-0.5 hidden text-[11px] text-muted-foreground sm:block">
                {t("brand.tagline")}
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <LocaleSwitcher />

          <Link href="/account" className="hidden sm:inline-flex">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <Ticket className="h-4 w-4" />
              <span>{t("nav.myBookings")}</span>
            </Button>
          </Link>

          {isAuthenticated ? (
            <Link href="/account">
              <Button variant="outline" size="sm" className="gap-1.5">
                <User className="h-4 w-4" />
                <span className="max-w-28 truncate">
                  {profile?.full_name || user?.phone}
                </span>
              </Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button size="sm">{t("common.signIn")}</Button>
            </Link>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t bg-card px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/account"
              onClick={() => setMobileOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-muted"
            >
              {t("nav.myBookings")}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
