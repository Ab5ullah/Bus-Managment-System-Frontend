"use client";

import { useTranslations } from "next-intl";
import { Bus } from "lucide-react";
import { Link } from "@/i18n/routing";

export function SiteFooter() {
  const t = useTranslations();

  return (
    <footer className="border-t bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Bus className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">{t("brand.name")}</span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("brand.tagline")} — Motorway Express, Executive, Luxury & Sleeper coach corridors across Pakistan.
          </p>
        </div>

        <div className="space-y-2.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("nav.routes")}
          </h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/routes/lahore-to-islamabad" className="text-muted-foreground hover:text-foreground">
                Lahore → Islamabad
              </Link>
            </li>
            <li>
              <Link href="/routes/lahore-to-faisalabad" className="text-muted-foreground hover:text-foreground">
                Lahore → Faisalabad
              </Link>
            </li>
            <li>
              <Link href="/routes/lahore-to-peshawar" className="text-muted-foreground hover:text-foreground">
                Lahore → Peshawar
              </Link>
            </li>
            <li>
              <Link href="/routes" className="font-medium text-primary hover:underline">
                {t("home.viewAllRoutes")}
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-2.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Passenger Info
          </h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/terminals" className="text-muted-foreground hover:text-foreground">
                {t("nav.terminals")}
              </Link>
            </li>
            <li>
              <Link href="/faq" className="text-muted-foreground hover:text-foreground">
                {t("nav.faq")}
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-muted-foreground hover:text-foreground">
                {t("nav.terms")}
              </Link>
            </li>
            <li>
              <Link href="/contact" className="text-muted-foreground hover:text-foreground">
                {t("nav.contact")}
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-2.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Dispatch & Support
          </h4>
          <p className="font-mono text-sm text-foreground">+92 (42) 111-723-270</p>
          <p className="text-xs text-muted-foreground">support@safarline.pk</p>
          <p className="text-xs text-muted-foreground">
            24/7 Central Operations Control · Lahore · Islamabad · Faisalabad · Peshawar
          </p>
        </div>
      </div>

      <div className="border-t bg-muted/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <span>© 2026 {t("brand.name")}. All fares in PKR (incl. 5% tax & PKR 50 platform fee at checkout).</span>
          <span>EN (LTR) · اردو (RTL)</span>
        </div>
      </div>
    </footer>
  );
}
