"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { LOCALES, type AppLocale } from "@busms/config/constants";
import { Globe } from "lucide-react";

export function LocaleSwitcher() {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();

  const handleSwitch = (nextLocale: AppLocale) => {
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <div className="inline-flex items-center gap-1 rounded-md border bg-card p-0.5 text-xs">
      <Globe className="ms-1.5 h-3.5 w-3.5 text-muted-foreground" />
      {LOCALES.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => handleSwitch(loc)}
          className={`rounded px-2 py-1 font-medium transition-colors ${
            locale === loc
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {loc === "en" ? "EN" : "اردو"}
        </button>
      ))}
    </div>
  );
}
