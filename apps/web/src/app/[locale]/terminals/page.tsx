import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TerminalsDirectoryClient } from "@/components/terminals-directory-client";
import { fetchPopularRoutes, fetchTerminals } from "@/lib/public-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Terminals & Stations | SafarLine",
  description: "Locate SafarLine boarding terminals, motorway rest areas, and station helpdesks.",
};

export default async function TerminalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations();
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const pageSize = Number(sp.page_size) || 12;
  const city = typeof sp.city === "string" ? sp.city : "";
  const search = typeof sp.search === "string" ? sp.search : "";

  const [terminalsData, popular] = await Promise.all([
    fetchTerminals({ page, pageSize, city: city || undefined, search: search || undefined }),
    fetchPopularRoutes(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-10 sm:px-6">
        <div className="border-b pb-5">
          <h1 className="text-2xl font-semibold tracking-tight">{t("terminalsPage.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("terminalsPage.subtitle")}</p>
        </div>

        <TerminalsDirectoryClient
          initialData={terminalsData}
          cities={popular.cities}
          initialCity={city}
          initialSearch={search}
        />
      </main>

      <SiteFooter />
    </div>
  );
}
